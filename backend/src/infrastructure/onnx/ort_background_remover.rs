use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use image::imageops::FilterType;
use image::{GrayImage, Luma, RgbaImage};
use ort::environment::Environment;
use ort::ep;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Tensor;
use parking_lot::{Mutex, RwLock};
use tracing::{error, info};

use crate::domain::entities::{BackgroundModel, SamPrompt};
use crate::domain::errors::DomainError;
use crate::domain::ports::BackgroundRemoverOutputPort;

enum LoadedModel {
    Single(Mutex<Session>),
    Sam {
        encoder: Mutex<Session>,
        decoder: Mutex<Session>,
        is_mobile_sam: bool,
    },
}

struct CachedSamEmbedding {
    image_hash: u64,
    shape: Vec<usize>,
    data: Vec<f32>,
}

const MAX_CACHED_SAM_EMBEDDINGS: usize = 4;

pub struct OrtBackgroundRemover {
    env: Environment,
    models_dir: PathBuf,
    sessions: RwLock<HashMap<BackgroundModel, Arc<LoadedModel>>>,
    sam_embedding_cache: Mutex<Vec<CachedSamEmbedding>>,
}

impl OrtBackgroundRemover {
    pub fn new(models_dir: impl Into<PathBuf>) -> Result<Self, DomainError> {
        let env = ort::init()
            .with_execution_providers([ep::CPU::default().build()])
            .build()
            .map_err(|e| DomainError::ModelError {
                model: "ort_env".to_string(),
                message: format!("Failed to initialize ONNX Runtime environment: {e}"),
            })?;

        Ok(Self {
            env,
            models_dir: models_dir.into(),
            sessions: RwLock::new(HashMap::new()),
            sam_embedding_cache: Mutex::new(Vec::with_capacity(MAX_CACHED_SAM_EMBEDDINGS)),
        })
    }

    fn compute_image_hash(image: &RgbaImage) -> u64 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        let (w, h) = image.dimensions();
        w.hash(&mut hasher);
        h.hash(&mut hasher);
        let raw = image.as_raw();
        let step = (raw.len() / 4096).max(1);
        for chunk in raw.chunks(step) {
            if let Some(&b) = chunk.first() {
                b.hash(&mut hasher);
            }
        }
        hasher.finish()
    }

    fn require_local_file(&self, filename: &str) -> Result<PathBuf, DomainError> {
        let path = self.models_dir.join(filename);
        if path.exists() {
            Ok(path)
        } else {
            Err(DomainError::ModelError {
                model: filename.to_string(),
                message: format!(
                    "ONNX model file not found at {:?}. Run `python backend/download_models.py` to download models into {:?}.",
                    path, self.models_dir
                ),
            })
        }
    }

    fn resolve_model_paths(&self, model: BackgroundModel) -> Result<Vec<PathBuf>, DomainError> {
        match model {
            BackgroundModel::U2Net => Ok(vec![self.require_local_file("u2net.onnx")?]),
            BackgroundModel::IsNetGeneralUse => {
                Ok(vec![self.require_local_file("isnet-general-use.onnx")?])
            }
            BackgroundModel::Silueta => Ok(vec![self.require_local_file("silueta.onnx")?]),
            BackgroundModel::Sam => {
                // Prefer MobileSAM (TinyViT-5M, 28MB encoder + 16MB decoder: ~7x faster & <80MB RAM)
                let mobile_enc = self.models_dir.join("mobile_sam.encoder.onnx");
                let mobile_dec = self.models_dir.join("mobile_sam.decoder.onnx");
                if mobile_enc.exists() && mobile_dec.exists() {
                    return Ok(vec![mobile_enc, mobile_dec]);
                }

                let quant_enc = self.models_dir.join("sam_vit_b_01ec64.encoder.quant.onnx");
                let quant_dec = self.models_dir.join("sam_vit_b_01ec64.decoder.quant.onnx");
                if quant_enc.exists() && quant_dec.exists() {
                    return Ok(vec![quant_enc, quant_dec]);
                }
                let enc = self.require_local_file("sam_vit_b_01ec64.encoder.onnx")?;
                let dec = self.require_local_file("sam_vit_b_01ec64.decoder.onnx")?;
                Ok(vec![enc, dec])
            }
        }
    }

    fn build_session(&self, path: &Path, model_name: &str) -> Result<Session, DomainError> {
        let intra_threads = std::thread::available_parallelism()
            .map(|n| (n.get() / 2).clamp(4, 12))
            .unwrap_or(8);

        Session::builder(&self.env)
            .map_err(|e| DomainError::ModelError {
                model: model_name.to_string(),
                message: format!("Failed to create ONNX SessionBuilder: {e}"),
            })?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| DomainError::ModelError {
                model: model_name.to_string(),
                message: format!("Failed to set Level3 graph optimization: {e}"),
            })?
            .with_intra_threads(intra_threads)
            .map_err(|e| DomainError::ModelError {
                model: model_name.to_string(),
                message: format!("Failed to configure intra-op threads: {e}"),
            })?
            .commit_from_file(path)
            .map_err(|e| DomainError::ModelError {
                model: model_name.to_string(),
                message: format!("Failed to load ONNX model from {:?}: {e}", path),
            })
    }

    fn get_or_load_model(&self, model: BackgroundModel) -> Result<Arc<LoadedModel>, DomainError> {
        {
            let read_guard = self.sessions.read();
            if let Some(loaded) = read_guard.get(&model) {
                return Ok(Arc::clone(loaded));
            }
        }

        let mut write_guard = self.sessions.write();
        if let Some(loaded) = write_guard.get(&model) {
            return Ok(Arc::clone(loaded));
        }

        info!("Loading ONNX model: {}...", model.as_str());
        let paths = self.resolve_model_paths(model)?;

        let loaded = match model {
            BackgroundModel::Sam => {
                let is_mobile_sam = paths[0]
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.starts_with("mobile_sam"))
                    .unwrap_or(false);
                let encoder = self.build_session(&paths[0], "sam_encoder")?;
                let decoder = self.build_session(&paths[1], "sam_decoder")?;
                Arc::new(LoadedModel::Sam {
                    encoder: Mutex::new(encoder),
                    decoder: Mutex::new(decoder),
                    is_mobile_sam,
                })
            }
            _ => {
                let session = self.build_session(&paths[0], model.as_str())?;
                Arc::new(LoadedModel::Single(Mutex::new(session)))
            }
        };

        info!("Model {} loaded successfully!", model.as_str());
        write_guard.insert(model, Arc::clone(&loaded));
        Ok(loaded)
    }

    /// Normalizes an RGBA image into a `[1, 3, target_h, target_w]` NCHW `f32` tensor
    /// matching `BaseSession.normalize` in `rembg`.
    fn normalize_image(
        image: &RgbaImage,
        mean: [f32; 3],
        std: [f32; 3],
        target_w: u32,
        target_h: u32,
    ) -> Vec<f32> {
        let resized = image::imageops::resize(image, target_w, target_h, FilterType::Triangle);

        let mut max_val: f32 = 1e-6;
        for pixel in resized.pixels() {
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;
            if r > max_val {
                max_val = r;
            }
            if g > max_val {
                max_val = g;
            }
            if b > max_val {
                max_val = b;
            }
        }

        let plane_size = (target_w * target_h) as usize;
        let mut tensor_data = vec![0.0_f32; 3 * plane_size];

        for y in 0..target_h {
            for x in 0..target_w {
                let p = resized.get_pixel(x, y);
                let idx = (y * target_w + x) as usize;
                let r = (p[0] as f32 / max_val - mean[0]) / std[0];
                let g = (p[1] as f32 / max_val - mean[1]) / std[1];
                let b = (p[2] as f32 / max_val - mean[2]) / std[2];

                tensor_data[idx] = r;
                tensor_data[plane_size + idx] = g;
                tensor_data[2 * plane_size + idx] = b;
            }
        }

        tensor_data
    }

    fn run_standard_segmentation(
        &self,
        session_mutex: &Mutex<Session>,
        image: &RgbaImage,
        model: BackgroundModel,
        mean: [f32; 3],
        std: [f32; 3],
        target_w: u32,
        target_h: u32,
    ) -> Result<GrayImage, DomainError> {
        let (orig_w, orig_h) = image.dimensions();
        let input_data = Self::normalize_image(image, mean, std, target_w, target_h);

        let input_tensor = Tensor::from_array((
            [1usize, 3, target_h as usize, target_w as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| DomainError::ModelError {
            model: model.as_str().to_string(),
            message: format!("Failed to construct input tensor: {e}"),
        })?;

        let mut session = session_mutex.lock();
        let outputs = session
            .run(ort::inputs![input_tensor])
            .map_err(|e| DomainError::ModelError {
                model: model.as_str().to_string(),
                message: format!("ONNX inference failed: {e}"),
            })?;

        let (_, raw_pred) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| DomainError::ModelError {
                model: model.as_str().to_string(),
                message: format!("Failed to extract output tensor: {e}"),
            })?;

        let plane_len = (target_w * target_h) as usize;
        let pred_slice = &raw_pred[..plane_len.min(raw_pred.len())];

        let mut min_v = f32::INFINITY;
        let mut max_v = f32::NEG_INFINITY;
        for &v in pred_slice {
            if v < min_v {
                min_v = v;
            }
            if v > max_v {
                max_v = v;
            }
        }

        let denom = if (max_v - min_v).abs() < 1e-6 {
            1.0
        } else {
            max_v - min_v
        };

        let mut mask_small = GrayImage::new(target_w, target_h);
        for y in 0..target_h {
            for x in 0..target_w {
                let idx = (y * target_w + x) as usize;
                let norm = ((pred_slice[idx] - min_v) / denom).clamp(0.0, 1.0);
                let byte = (norm * 255.0) as u8;
                mask_small.put_pixel(x, y, Luma([byte]));
            }
        }

        let mask_resized =
            image::imageops::resize(&mask_small, orig_w, orig_h, FilterType::Triangle);
        Ok(mask_resized)
    }

    /// Identifies the contiguous physical surface of matching color connected to `(seed_x, seed_y)`,
    /// strictly bounded by a maximum pixel offset (`max_offset_px`) and color tolerance (`color_tolerance`).
    fn extract_contiguous_surface(
        image: &RgbaImage,
        seed_x: f32,
        seed_y: f32,
        opposing_seeds: &[(f32, f32)],
        max_offset_px: u32,
        color_tolerance: u8,
    ) -> GrayImage {
        let (orig_w, orig_h) = image.dimensions();
        if orig_w == 0 || orig_h == 0 {
            return GrayImage::new(orig_w, orig_h);
        }

        // Keep sharp resolution up to 1024px so thin 1-2px die-cut edges and borders are never blurred
        let max_work_dim: u32 = 1024;
        let work_scale = if orig_w.max(orig_h) > max_work_dim {
            (max_work_dim as f32) / (orig_w.max(orig_h) as f32)
        } else {
            1.0
        };
        let gw = (((orig_w as f32) * work_scale).round() as u32).max(1);
        let gh = (((orig_h as f32) * work_scale).round() as u32).max(1);

        let work_img = if work_scale < 1.0 {
            image::imageops::resize(image, gw, gh, FilterType::Nearest)
        } else {
            image.clone()
        };

        let sx = ((seed_x * work_scale).round() as i32).clamp(0, (gw as i32) - 1) as u32;
        let sy = ((seed_y * work_scale).round() as i32).clamp(0, (gh as i32) - 1) as u32;

        // Sample a tight 3x3 patch around the seed point
        let sample_patch = |cx: u32, cy: u32| -> ([f32; 3], f32) {
            let mut sum = [0.0_f32; 3];
            let mut sum_sq = [0.0_f32; 3];
            let mut count = 0.0_f32;
            let x0 = cx.saturating_sub(1);
            let x1 = (cx + 1).min(gw - 1);
            let y0 = cy.saturating_sub(1);
            let y1 = (cy + 1).min(gh - 1);
            for py in y0..=y1 {
                for px in x0..=x1 {
                    let p = work_img.get_pixel(px, py);
                    for c in 0..3 {
                        let v = p[c] as f32;
                        sum[c] += v;
                        sum_sq[c] += v * v;
                    }
                    count += 1.0;
                }
            }
            let mean = [sum[0] / count, sum[1] / count, sum[2] / count];
            let var = ((sum_sq[0] / count - mean[0] * mean[0]).max(0.0)
                + (sum_sq[1] / count - mean[1] * mean[1]).max(0.0)
                + (sum_sq[2] / count - mean[2] * mean[2]).max(0.0))
                / 3.0;
            (mean, var.sqrt())
        };

        let (seed_rgb, seed_std) = sample_patch(sx, sy);

        let opp_patches: Vec<([f32; 3], u32, u32)> = opposing_seeds
            .iter()
            .map(|&(ox, oy)| {
                let osx = ((ox * work_scale).round() as i32).clamp(0, (gw as i32) - 1) as u32;
                let osy = ((oy * work_scale).round() as i32).clamp(0, (gh as i32) - 1) as u32;
                let (rgb, _) = sample_patch(osx, osy);
                (rgb, osx, osy)
            })
            .collect();

        // Scale max_offset_px relative to a 1000px reference canvas so the pixel offset
        // behaves identically regardless of camera resolution (and equals literal pixels on 1000px images)
        let ref_scale = ((orig_w.max(orig_h) as f32) / 1000.0).clamp(0.25, 4.0);
        let max_radius = ((max_offset_px as f32) * ref_scale * work_scale).max(6.0);
        let max_radius_sq = max_radius * max_radius;

        // Strict per-channel & Euclidean color tolerances + local edge/cut-line stopper
        let tol = ((color_tolerance as f32) + seed_std * 0.45).clamp(6.0, 95.0);
        let tol_euclid_sq = (tol * 1.42) * (tol * 1.42);
        let step_limit = (tol * 0.46 + seed_std * 0.35).clamp(8.0, 22.0);

        let total_px = (gw * gh) as usize;
        let mut visited = vec![0u8; total_px];
        let mut queue = std::collections::VecDeque::with_capacity(4096);

        // Initialize BFS with 3x3 seed neighborhood
        for ny in sy.saturating_sub(1)..=(sy + 1).min(gh - 1) {
            for nx in sx.saturating_sub(1)..=(sx + 1).min(gw - 1) {
                let idx = (ny * gw + nx) as usize;
                visited[idx] = 255;
                queue.push_back((nx, ny));
            }
        }

        let neighbors: [(i32, i32); 8] = [
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (1, -1),
            (-1, 1),
            (1, 1),
        ];

        while let Some((cx, cy)) = queue.pop_front() {
            let cur_p = work_img.get_pixel(cx, cy);
            let cr = cur_p[0] as f32;
            let cg = cur_p[1] as f32;
            let cb = cur_p[2] as f32;

            for &(dx, dy) in &neighbors {
                let nx_i = (cx as i32) + dx;
                let ny_i = (cy as i32) + dy;
                if nx_i < 0 || ny_i < 0 || nx_i >= (gw as i32) || ny_i >= (gh as i32) {
                    continue;
                }
                let nx = nx_i as u32;
                let ny = ny_i as u32;
                let n_idx = (ny * gw + nx) as usize;
                if visited[n_idx] != 0 {
                    continue;
                }

                // 1. Strict Max Pixel Offset check around seed point
                let dx_seed = (nx as f32) - (sx as f32);
                let dy_seed = (ny as f32) - (sy as f32);
                let dist_to_seed_sq = dx_seed * dx_seed + dy_seed * dy_seed;
                if dist_to_seed_sq > max_radius_sq {
                    continue;
                }

                let np = work_img.get_pixel(nx, ny);
                let nr = np[0] as f32;
                let ng = np[1] as f32;
                let nb = np[2] as f32;

                // 2. Local pixel-to-pixel step check (stops at crisp die-cut lines & borders)
                let step_max = (nr - cr).abs().max((ng - cg).abs()).max((nb - cb).abs());
                if step_max > step_limit {
                    continue;
                }

                // 3. Per-channel max difference & Euclidean distance to seed color
                let dr = (nr - seed_rgb[0]).abs();
                let dg = (ng - seed_rgb[1]).abs();
                let db = (nb - seed_rgb[2]).abs();
                if dr.max(dg).max(db) > tol {
                    continue;
                }
                let seed_d2 = dr * dr + dg * dg + db * db;
                if seed_d2 > tol_euclid_sq {
                    continue;
                }

                // 4. Opposing seed boundary check (+ vs -)
                let mut blocked_by_opposing = false;
                for &(opp_rgb, osx, osy) in &opp_patches {
                    let dist_to_opp_sq =
                        ((nx as f32 - osx as f32).powi(2)) + ((ny as f32 - osy as f32).powi(2));
                    if dist_to_opp_sq < 9.0
                        || (dist_to_opp_sq < dist_to_seed_sq && {
                            let opp_d2 = (nr - opp_rgb[0]).powi(2)
                                + (ng - opp_rgb[1]).powi(2)
                                + (nb - opp_rgb[2]).powi(2);
                            opp_d2 <= seed_d2 + 100.0
                        })
                    {
                        blocked_by_opposing = true;
                        break;
                    }
                }
                if blocked_by_opposing {
                    continue;
                }

                visited[n_idx] = 255;
                queue.push_back((nx, ny));
            }
        }

        // 1px boundary dilation for anti-aliased fringe pixels that still match the seed color
        let mut dilated = visited.clone();
        let fringe_tol = (tol * 1.25).min(110.0);
        for y in 1..gh.saturating_sub(1) {
            for x in 1..gw.saturating_sub(1) {
                let idx = (y * gw + x) as usize;
                if visited[idx] != 0 {
                    continue;
                }
                let dx_seed = (x as f32) - (sx as f32);
                let dy_seed = (y as f32) - (sy as f32);
                if dx_seed * dx_seed + dy_seed * dy_seed > max_radius_sq {
                    continue;
                }
                if visited[idx - 1] == 255
                    || visited[idx + 1] == 255
                    || visited[(idx as usize) - (gw as usize)] == 255
                    || visited[(idx as usize) + (gw as usize)] == 255
                {
                    let p = work_img.get_pixel(x, y);
                    let dr = (p[0] as f32 - seed_rgb[0]).abs();
                    let dg = (p[1] as f32 - seed_rgb[1]).abs();
                    let db = (p[2] as f32 - seed_rgb[2]).abs();
                    if dr.max(dg).max(db) <= fringe_tol {
                        dilated[idx] = 255;
                    }
                }
            }
        }

        let mut surface_small = GrayImage::new(gw, gh);
        for y in 0..gh {
            for x in 0..gw {
                surface_small.put_pixel(x, y, Luma([dilated[(y * gw + x) as usize]]));
            }
        }

        if work_scale < 1.0 {
            image::imageops::resize(&surface_small, orig_w, orig_h, FilterType::Triangle)
        } else {
            surface_small
        }
    }

    /// Reinforces the SAM base mask so internal logos, text (e.g. "Inodorox", "BLOQUE MOCHILA",
    /// "Acción continua"), and enclosed cardboard spans are 100% solid `255` while outer
    /// studio margins are stripped before applying interactive `+`/`-` surface offsets.
    fn solidify_base_product_mask(
        image: &RgbaImage,
        mask: &mut GrayImage,
        box_bounds: (u32, u32, u32, u32),
        color_tolerance: u8,
    ) {
        let (w, h) = image.dimensions();
        if w < 8 || h < 8 {
            return;
        }
        let (bx1, by1, bx2, by2) = box_bounds;

        // 1. Estimate dominant outer border background color from the 4 corners
        let corner_coords = [
            (2.min(w - 1), 2.min(h - 1)),
            (w.saturating_sub(3), 2.min(h - 1)),
            (2.min(w - 1), h.saturating_sub(3)),
            (w.saturating_sub(3), h.saturating_sub(3)),
        ];
        let mut corner_rgbs = [[0.0_f32; 3]; 4];
        for (i, &(cx, cy)) in corner_coords.iter().enumerate() {
            let p = image.get_pixel(cx, cy);
            corner_rgbs[i] = [p[0] as f32, p[1] as f32, p[2] as f32];
        }

        let mut best_corner = corner_rgbs[0];
        let mut best_matches = 0;
        for i in 0..4 {
            let mut m = 0;
            for j in 0..4 {
                let diff = (corner_rgbs[i][0] - corner_rgbs[j][0])
                    .abs()
                    .max((corner_rgbs[i][1] - corner_rgbs[j][1]).abs())
                    .max((corner_rgbs[i][2] - corner_rgbs[j][2]).abs());
                if diff <= 28.0 {
                    m += 1;
                }
            }
            if m > best_matches {
                best_matches = m;
                best_corner = corner_rgbs[i];
            }
        }

        let bg_tol = (color_tolerance as f32).clamp(18.0, 36.0);

        if best_matches >= 2 {
            // Strip outer background pixels that match the studio corner color, and mark all
            // contrasting product pixels inside the box as 255
            for y in 0..h {
                for x in 0..w {
                    if x < bx1 || x > bx2 || y < by1 || y > by2 {
                        let p = image.get_pixel(x, y);
                        let diff = (p[0] as f32 - best_corner[0])
                            .abs()
                            .max((p[1] as f32 - best_corner[1]).abs())
                            .max((p[2] as f32 - best_corner[2]).abs());
                        if diff <= bg_tol {
                            mask.put_pixel(x, y, Luma([0]));
                        }
                    } else {
                        let p = image.get_pixel(x, y);
                        let diff = (p[0] as f32 - best_corner[0])
                            .abs()
                            .max((p[1] as f32 - best_corner[1]).abs())
                            .max((p[2] as f32 - best_corner[2]).abs());
                        if diff > bg_tol {
                            mask.put_pixel(x, y, Luma([255]));
                        } else {
                            mask.put_pixel(x, y, Luma([0]));
                        }
                    }
                }
            }

            // Horizontal scanline span fill: fills cardboard regions sitting between the left
            // and right colored edges of the product (e.g. the white top arch around "Inodorox"),
            // while keeping outer left/right margins (0..lx and rx..w) at 0!
            for y in by1..=by2.min(h - 1) {
                let mut first_x: Option<u32> = None;
                let mut last_x: Option<u32> = None;
                for x in bx1..=bx2.min(w - 1) {
                    if mask.get_pixel(x, y)[0] >= 128 {
                        if first_x.is_none() {
                            first_x = Some(x);
                        }
                        last_x = Some(x);
                    }
                }
                if let (Some(lx), Some(rx)) = (first_x, last_x) {
                    if rx >= lx {
                        for x in lx..=rx {
                            mask.put_pixel(x, y, Luma([255]));
                        }
                    }
                }
            }
        }

        // Flood-fill from the 4 outer edges of the image to find true exterior background,
        // and fill any remaining enclosed interior holes to 255
        let total = (w * h) as usize;
        let mut is_exterior = vec![false; total];
        let mut q = std::collections::VecDeque::with_capacity((w + h) as usize * 2);

        for x in 0..w {
            let top_idx = x as usize;
            if mask.get_pixel(x, 0)[0] < 128 {
                is_exterior[top_idx] = true;
                q.push_back((x, 0u32));
            }
            let bot_y = h - 1;
            let bot_idx = (bot_y * w + x) as usize;
            if !is_exterior[bot_idx] && mask.get_pixel(x, bot_y)[0] < 128 {
                is_exterior[bot_idx] = true;
                q.push_back((x, bot_y));
            }
        }
        for y in 0..h {
            let left_idx = (y * w) as usize;
            if !is_exterior[left_idx] && mask.get_pixel(0, y)[0] < 128 {
                is_exterior[left_idx] = true;
                q.push_back((0u32, y));
            }
            let right_x = w - 1;
            let right_idx = (y * w + right_x) as usize;
            if !is_exterior[right_idx] && mask.get_pixel(right_x, y)[0] < 128 {
                is_exterior[right_idx] = true;
                q.push_back((right_x, y));
            }
        }

        let dirs: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
        while let Some((cx, cy)) = q.pop_front() {
            for &(dx, dy) in &dirs {
                let nx = (cx as i32) + dx;
                let ny = (cy as i32) + dy;
                if nx < 0 || ny < 0 || nx >= (w as i32) || ny >= (h as i32) {
                    continue;
                }
                let ux = nx as u32;
                let uy = ny as u32;
                let idx = (uy * w + ux) as usize;
                if !is_exterior[idx] && mask.get_pixel(ux, uy)[0] < 128 {
                    is_exterior[idx] = true;
                    q.push_back((ux, uy));
                }
            }
        }

        for y in 0..h {
            for x in 0..w {
                if !is_exterior[(y * w + x) as usize] {
                    mask.put_pixel(x, y, Luma([255]));
                }
            }
        }
    }

    fn get_or_compute_sam_embedding(
        &self,
        encoder_mutex: &Mutex<Session>,
        image: &RgbaImage,
        is_mobile_sam: bool,
    ) -> Result<(Vec<usize>, Vec<f32>), DomainError> {
        let img_hash = Self::compute_image_hash(image);
        {
            let cache_guard = self.sam_embedding_cache.lock();
            if let Some(cached) = cache_guard.iter().find(|c| c.image_hash == img_hash) {
                return Ok((cached.shape.clone(), cached.data.clone()));
            }
        }

        let (orig_w, orig_h) = image.dimensions();

        let computed = if is_mobile_sam {
            // MobileSAM TinyViT-5M expects NCHW [1, 3, 1024, 1024] normalized with ImageNet pixel stats
            let target_size: usize = 1024;
            let scale = (target_size as f32) / (orig_w.max(orig_h) as f32);
            let new_w = (((orig_w as f32) * scale + 0.5).floor() as u32).clamp(1, target_size as u32);
            let new_h = (((orig_h as f32) * scale + 0.5).floor() as u32).clamp(1, target_size as u32);

            let resized = image::imageops::resize(image, new_w, new_h, FilterType::Triangle);
            let mean = [123.675_f32, 116.28, 103.53];
            let std = [58.395_f32, 57.12, 57.375];

            let plane = target_size * target_size;
            let mut input_data = vec![0.0_f32; 3 * plane];

            for y in 0..new_h {
                let row_offset = (y as usize) * target_size;
                for x in 0..new_w {
                    let p = resized.get_pixel(x, y);
                    let idx = row_offset + (x as usize);
                    input_data[idx] = ((p[0] as f32) - mean[0]) / std[0];
                    input_data[plane + idx] = ((p[1] as f32) - mean[1]) / std[1];
                    input_data[2 * plane + idx] = ((p[2] as f32) - mean[2]) / std[2];
                }
            }

            let encoder_input = Tensor::from_array((
                [1usize, 3, target_size, target_size],
                input_data.into_boxed_slice(),
            ))
            .map_err(|e| DomainError::ModelError {
                model: "mobile_sam_encoder".to_string(),
                message: format!("Failed to create MobileSAM encoder input tensor: {e}"),
            })?;

            let mut encoder = encoder_mutex.lock();
            let enc_outputs = encoder
                .run(ort::inputs!["images" => encoder_input])
                .map_err(|e| DomainError::ModelError {
                    model: "mobile_sam_encoder".to_string(),
                    message: format!("MobileSAM encoder inference failed: {e}"),
                })?;

            let (shape, data) = enc_outputs[0]
                .try_extract_tensor::<f32>()
                .map_err(|e| DomainError::ModelError {
                    model: "mobile_sam_encoder".to_string(),
                    message: format!("Failed to extract MobileSAM embeddings: {e}"),
                })?;

            let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
            (dims, data.to_vec())
        } else {
            // Legacy SAM ViT-B expects HWC [684, 1024, 3]
            let in_h: usize = 684;
            let in_w: usize = 1024;
            let scale_x = (in_w as f32) / (orig_w as f32);
            let scale_y = (in_h as f32) / (orig_h as f32);
            let scale = scale_x.min(scale_y);

            let mut warped_rgb = vec![0.0_f32; in_h * in_w * 3];
            let inv_scale = 1.0 / scale;

            for dst_y in 0..in_h {
                let src_y = (dst_y as f32) * inv_scale;
                if src_y < 0.0 || src_y > (orig_h.saturating_sub(1) as f32) {
                    continue;
                }
                let y0 = src_y.floor() as u32;
                let y1 = (y0 + 1).min(orig_h.saturating_sub(1));
                let wy = src_y - (y0 as f32);

                for dst_x in 0..in_w {
                    let src_x = (dst_x as f32) * inv_scale;
                    if src_x < 0.0 || src_x > (orig_w.saturating_sub(1) as f32) {
                        continue;
                    }
                    let x0 = src_x.floor() as u32;
                    let x1 = (x0 + 1).min(orig_w.saturating_sub(1));
                    let wx = src_x - (x0 as f32);

                    let p00 = image.get_pixel(x0, y0);
                    let p01 = image.get_pixel(x1, y0);
                    let p10 = image.get_pixel(x0, y1);
                    let p11 = image.get_pixel(x1, y1);

                    let dst_idx = (dst_y * in_w + dst_x) * 3;
                    for c in 0..3 {
                        let top = (p00[c] as f32) * (1.0 - wx) + (p01[c] as f32) * wx;
                        let bot = (p10[c] as f32) * (1.0 - wx) + (p11[c] as f32) * wx;
                        let val = top * (1.0 - wy) + bot * wy;
                        warped_rgb[dst_idx + c] = (val as u8) as f32;
                    }
                }
            }

            let encoder_input =
                Tensor::from_array(([in_h, in_w, 3], warped_rgb.into_boxed_slice())).map_err(
                    |e| DomainError::ModelError {
                        model: "sam_encoder".to_string(),
                        message: format!("Failed to create SAM encoder input tensor: {e}"),
                    },
                )?;

            let mut encoder = encoder_mutex.lock();
            let enc_outputs = encoder
                .run(ort::inputs![encoder_input])
                .map_err(|e| DomainError::ModelError {
                    model: "sam_encoder".to_string(),
                    message: format!("SAM encoder inference failed: {e}"),
                })?;

            let (shape, data) = enc_outputs[0]
                .try_extract_tensor::<f32>()
                .map_err(|e| DomainError::ModelError {
                    model: "sam_encoder".to_string(),
                    message: format!("Failed to extract SAM image embeddings: {e}"),
                })?;

            let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
            (dims, data.to_vec())
        };

        {
            let mut cache_guard = self.sam_embedding_cache.lock();
            if cache_guard.len() >= MAX_CACHED_SAM_EMBEDDINGS {
                cache_guard.remove(0);
            }
            cache_guard.push(CachedSamEmbedding {
                image_hash: img_hash,
                shape: computed.0.clone(),
                data: computed.1.clone(),
            });
        }

        Ok(computed)
    }

    fn run_sam_segmentation(
        &self,
        encoder_mutex: &Mutex<Session>,
        decoder_mutex: &Mutex<Session>,
        is_mobile_sam: bool,
        image: &RgbaImage,
        prompts: Option<&[SamPrompt]>,
    ) -> Result<GrayImage, DomainError> {
        let (orig_w, orig_h) = image.dimensions();
        let default_prompts = SamPrompt::build_for_image(orig_w, orig_h, true);
        let input_prompts = match prompts {
            Some(p) if !p.is_empty() => p,
            _ => &default_prompts,
        };

        // Extract base bounding box Rectangle and SurfaceConfig (max_offset_px, color_tolerance)
        let mut rect_bounds = (
            ((orig_w as f32) * 0.02).round() as u32,
            ((orig_h as f32) * 0.02).round() as u32,
            ((orig_w as f32) * 0.98).round() as u32,
            ((orig_h as f32) * 0.98).round() as u32,
        );
        let mut max_offset_px: u32 = 160;
        let mut color_tolerance: u8 = 24;
        let mut pos_points: Vec<(f32, f32)> = Vec::new();
        let mut neg_points: Vec<(f32, f32)> = Vec::new();

        for mark in input_prompts {
            match *mark {
                SamPrompt::Rectangle { x1, y1, x2, y2 } => {
                    rect_bounds = (
                        (x1.max(0.0) as u32).min(orig_w.saturating_sub(1)),
                        (y1.max(0.0) as u32).min(orig_h.saturating_sub(1)),
                        (x2.max(1.0) as u32).min(orig_w.saturating_sub(1)),
                        (y2.max(1.0) as u32).min(orig_h.saturating_sub(1)),
                    );
                }
                SamPrompt::SurfaceConfig {
                    max_offset_px: mop,
                    color_tolerance: ct,
                } => {
                    max_offset_px = mop;
                    color_tolerance = ct;
                }
                SamPrompt::Point { x, y, label: 1 } => pos_points.push((x, y)),
                SamPrompt::Point { x, y, label: 0 } => neg_points.push((x, y)),
                _ => {}
            }
        }

        let target_size: f32 = 1024.0;
        let (in_h, in_w): (usize, usize) = if is_mobile_sam {
            (1024, 1024)
        } else {
            (684, 1024)
        };

        let scale_x = (in_w as f32) / (orig_w as f32);
        let scale_y = (in_h as f32) / (orig_h as f32);
        let scale = scale_x.min(scale_y);

        let (emb_shape, emb_data) =
            self.get_or_compute_sam_embedding(encoder_mutex, image, is_mobile_sam)?;

        // Run the neural SAM decoder strictly with the bounding box Rectangle so it extracts
        // the global object silhouette without punching holes in internal text/logos.
        let points: Vec<[f32; 2]> = vec![
            [rect_bounds.0 as f32, rect_bounds.1 as f32],
            [rect_bounds.2 as f32, rect_bounds.3 as f32],
            [0.0, 0.0],
        ];
        let labels: Vec<f32> = vec![2.0, 3.0, -1.0];

        let preprocess_scale = target_size / (in_h.max(in_w) as f32);
        let new_h = ((in_h as f32) * preprocess_scale + 0.5).floor();
        let new_w = ((in_w as f32) * preprocess_scale + 0.5).floor();

        let num_pts = points.len();
        let mut flat_coords = Vec::with_capacity(num_pts * 2);
        for pt in &points {
            let cx = pt[0] * (new_w / (in_w as f32)) * scale;
            let cy = pt[1] * (new_h / (in_h as f32)) * scale;
            flat_coords.push(cx);
            flat_coords.push(cy);
        }

        let emb_tensor = Tensor::from_array((emb_shape, emb_data.into_boxed_slice())).map_err(
            |e| DomainError::ModelError {
                model: "sam_decoder".to_string(),
                message: format!("Failed to build image_embeddings tensor: {e}"),
            },
        )?;

        let coord_tensor =
            Tensor::from_array(([1usize, num_pts, 2], flat_coords.into_boxed_slice())).map_err(
                |e| DomainError::ModelError {
                    model: "sam_decoder".to_string(),
                    message: format!("Failed to build point_coords tensor: {e}"),
                },
            )?;

        let label_tensor = Tensor::from_array(([1usize, num_pts], labels.into_boxed_slice()))
            .map_err(|e| DomainError::ModelError {
                model: "sam_decoder".to_string(),
                message: format!("Failed to build point_labels tensor: {e}"),
            })?;

        let mask_input_tensor = Tensor::from_array((
            [1usize, 1, 256, 256],
            vec![0.0_f32; 256 * 256].into_boxed_slice(),
        ))
        .map_err(|e| DomainError::ModelError {
            model: "sam_decoder".to_string(),
            message: format!("Failed to build mask_input tensor: {e}"),
        })?;

        let has_mask_input_tensor =
            Tensor::from_array(([1usize], vec![0.0_f32].into_boxed_slice())).map_err(|e| {
                DomainError::ModelError {
                    model: "sam_decoder".to_string(),
                    message: format!("Failed to build has_mask_input tensor: {e}"),
                }
            })?;

        let orig_im_size_tensor = Tensor::from_array((
            [2usize],
            vec![in_h as f32, in_w as f32].into_boxed_slice(),
        ))
        .map_err(|e| DomainError::ModelError {
            model: "sam_decoder".to_string(),
            message: format!("Failed to build orig_im_size tensor: {e}"),
        })?;

        let (mask_shape, mask_vec) = {
            let mut decoder = decoder_mutex.lock();
            let dec_outputs = decoder
                .run(ort::inputs! {
                    "image_embeddings" => emb_tensor,
                    "point_coords" => coord_tensor,
                    "point_labels" => label_tensor,
                    "mask_input" => mask_input_tensor,
                    "has_mask_input" => has_mask_input_tensor,
                    "orig_im_size" => orig_im_size_tensor
                })
                .map_err(|e| DomainError::ModelError {
                    model: "sam_decoder".to_string(),
                    message: format!("SAM decoder inference failed: {e}"),
                })?;

            let (s, d) = dec_outputs[0].try_extract_tensor::<f32>().map_err(|e| {
                DomainError::ModelError {
                    model: "sam_decoder".to_string(),
                    message: format!("Failed to extract SAM decoder masks: {e}"),
                }
            })?;
            let dims: Vec<i64> = s.iter().copied().collect();
            (dims, d.to_vec())
        };

        let num_masks = if mask_shape.len() >= 2 {
            mask_shape[1] as usize
        } else {
            1
        };
        let mask_h = if mask_shape.len() >= 4 {
            mask_shape[2] as usize
        } else {
            in_h
        };
        let mask_w = if mask_shape.len() >= 4 {
            mask_shape[3] as usize
        } else {
            in_w
        };

        let mut out_mask = GrayImage::new(orig_w, orig_h);
        let plane = mask_h * mask_w;

        for y in 0..orig_h {
            let sy = (y as f32) * scale;
            if sy < 0.0 || sy > (mask_h.saturating_sub(1) as f32) {
                continue;
            }
            let y0 = sy.floor() as usize;
            let y1 = (y0 + 1).min(mask_h.saturating_sub(1));
            let wy = sy - (y0 as f32);

            for x in 0..orig_w {
                let sx = (x as f32) * scale;
                if sx < 0.0 || sx > (mask_w.saturating_sub(1) as f32) {
                    continue;
                }
                let x0 = sx.floor() as usize;
                let x1 = (x0 + 1).min(mask_w.saturating_sub(1));
                let wx = sx - (x0 as f32);

                let mut max_logit = f32::NEG_INFINITY;
                for m_idx in 0..num_masks {
                    let base = m_idx * plane;
                    let v00 = mask_vec[base + y0 * mask_w + x0];
                    let v01 = mask_vec[base + y0 * mask_w + x1];
                    let v10 = mask_vec[base + y1 * mask_w + x0];
                    let v11 = mask_vec[base + y1 * mask_w + x1];

                    let top = v00 * (1.0 - wx) + v01 * wx;
                    let bot = v10 * (1.0 - wx) + v11 * wx;
                    let val = top * (1.0 - wy) + bot * wy;

                    if val > max_logit {
                        max_logit = val;
                    }
                }

                if max_logit > 0.0 {
                    out_mask.put_pixel(x, y, Luma([255]));
                }
            }
        }

        // Solidify the base mask so internal text/logos ("Inodorox", "Acción continua",
        // "BLOQUE MOCHILA", "Cont. Neto 30g") and cardboard spans never have internal holes
        Self::solidify_base_product_mask(image, &mut out_mask, rect_bounds, color_tolerance);

        // Apply Interactive Points using Contiguous Color Detection bounded by max_offset_px:
        // 1. Subtract Delete (−) color surfaces within max_offset_px around each negative point
        for &(nx, ny) in &neg_points {
            let neg_surface = Self::extract_contiguous_surface(
                image,
                nx,
                ny,
                &pos_points,
                max_offset_px,
                color_tolerance,
            );
            for y in 0..orig_h {
                for x in 0..orig_w {
                    let del_val = neg_surface.get_pixel(x, y)[0];
                    if del_val > 0 {
                        let cur = out_mask.get_pixel(x, y)[0];
                        out_mask.put_pixel(x, y, Luma([cur.saturating_sub(del_val)]));
                    }
                }
            }
        }

        // 2. Add Preserve (+) color surfaces within max_offset_px around each positive point
        for &(px, py) in &pos_points {
            let mut opposing = neg_points.clone();
            let margin_x = (orig_w as f32) * 0.04;
            let margin_y = (orig_h as f32) * 0.04;
            if px > margin_x
                && px < (orig_w as f32 - margin_x)
                && py > margin_y
                && py < (orig_h as f32 - margin_y)
            {
                opposing.push((2.0, 2.0));
                opposing.push(((orig_w.saturating_sub(3)) as f32, 2.0));
                opposing.push((2.0, (orig_h.saturating_sub(3)) as f32));
                opposing.push((
                    (orig_w.saturating_sub(3)) as f32,
                    (orig_h.saturating_sub(3)) as f32,
                ));
            }

            let pos_surface = Self::extract_contiguous_surface(
                image,
                px,
                py,
                &opposing,
                max_offset_px,
                color_tolerance,
            );
            for y in 0..orig_h {
                for x in 0..orig_w {
                    let s_val = pos_surface.get_pixel(x, y)[0];
                    if s_val > 0 {
                        let cur = out_mask.get_pixel(x, y)[0];
                        if s_val > cur {
                            out_mask.put_pixel(x, y, Luma([s_val]));
                        }
                    }
                }
            }
        }

        Ok(out_mask)
    }
}

impl BackgroundRemoverOutputPort for OrtBackgroundRemover {
    fn predict_mask(
        &self,
        image: &RgbaImage,
        model: BackgroundModel,
        sam_prompts: Option<&[SamPrompt]>,
    ) -> Result<GrayImage, DomainError> {
        let loaded = self.get_or_load_model(model)?;
        match (&*loaded, model) {
            (LoadedModel::Single(session), BackgroundModel::U2Net) => self
                .run_standard_segmentation(
                    session,
                    image,
                    model,
                    [0.485, 0.456, 0.406],
                    [0.229, 0.224, 0.225],
                    320,
                    320,
                ),
            (LoadedModel::Single(session), BackgroundModel::Silueta) => self
                .run_standard_segmentation(
                    session,
                    image,
                    model,
                    [0.485, 0.456, 0.406],
                    [0.229, 0.224, 0.225],
                    320,
                    320,
                ),
            (LoadedModel::Single(session), BackgroundModel::IsNetGeneralUse) => self
                .run_standard_segmentation(
                    session,
                    image,
                    model,
                    [0.5, 0.5, 0.5],
                    [1.0, 1.0, 1.0],
                    1024,
                    1024,
                ),
            (
                LoadedModel::Sam {
                    encoder,
                    decoder,
                    is_mobile_sam,
                },
                BackgroundModel::Sam,
            ) => self.run_sam_segmentation(encoder, decoder, *is_mobile_sam, image, sam_prompts),
            _ => Err(DomainError::ModelError {
                model: model.as_str().to_string(),
                message: "Mismatched model session variant".to_string(),
            }),
        }
    }

    fn preload_models(&self, models: &[BackgroundModel]) {
        for &model in models {
            if let Err(e) = self.get_or_load_model(model) {
                error!("Failed to preload model {}: {}", model.as_str(), e);
            }
        }
    }
}
