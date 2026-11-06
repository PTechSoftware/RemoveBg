use std::io::Cursor;
use std::num::NonZeroU8;

use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{GrayImage, RgbImage, Rgba, RgbaImage};
use oxipng::{
    BitDepth as OxiBitDepth, ColorType as OxiColorType, Deflaters, Options as OxiOptions, RawImage,
    StripChunks,
};
use png::{BitDepth, ColorType, Compression, Encoder, FilterType as PngFilterType};
use visioncortex::PathSimplifyMode;
use vtracer::{ColorImage, ColorMode, Config as VTracerConfig, Hierarchical};

use crate::domain::entities::{
    CompressionMode, OutputFormat, ProcessingMode, TraceCurveMode, TracePreset, UpscaleConfig,
    VectorizeConfig,
};
use crate::domain::errors::DomainError;
use crate::domain::ports::ImageProcessorOutputPort;

pub struct NativeImageProcessor;

impl NativeImageProcessor {
    pub fn new() -> Self {
        Self
    }

    fn enhance_brightness(image: &RgbaImage, factor: f32) -> RgbaImage {
        if (factor - 1.0).abs() <= f32::EPSILON {
            return image.clone();
        }
        let (w, h) = image.dimensions();
        let mut out = RgbaImage::new(w, h);
        for (x, y, p) in image.enumerate_pixels() {
            let r = ((p[0] as f32) * factor).round().clamp(0.0, 255.0) as u8;
            let g = ((p[1] as f32) * factor).round().clamp(0.0, 255.0) as u8;
            let b = ((p[2] as f32) * factor).round().clamp(0.0, 255.0) as u8;
            out.put_pixel(x, y, Rgba([r, g, b, p[3]]));
        }
        out
    }

    fn enhance_saturation(image: &RgbaImage, factor: f32) -> RgbaImage {
        if (factor - 1.0).abs() <= f32::EPSILON {
            return image.clone();
        }
        let (w, h) = image.dimensions();
        let mut out = RgbaImage::new(w, h);
        for (x, y, p) in image.enumerate_pixels() {
            let r = p[0] as f32;
            let g = p[1] as f32;
            let b = p[2] as f32;
            let luma = 0.299 * r + 0.587 * g + 0.114 * b;

            let nr = (luma + (r - luma) * factor).round().clamp(0.0, 255.0) as u8;
            let ng = (luma + (g - luma) * factor).round().clamp(0.0, 255.0) as u8;
            let nb = (luma + (b - luma) * factor).round().clamp(0.0, 255.0) as u8;
            out.put_pixel(x, y, Rgba([nr, ng, nb, p[3]]));
        }
        out
    }

    fn enhance_contrast(image: &RgbaImage, factor: f32) -> RgbaImage {
        if (factor - 1.0).abs() <= f32::EPSILON {
            return image.clone();
        }
        let (w, h) = image.dimensions();
        let total_pixels = (w as usize * h as usize).max(1) as f32;
        let mut sum_luma = 0.0_f32;
        for p in image.pixels() {
            sum_luma += 0.299 * (p[0] as f32) + 0.587 * (p[1] as f32) + 0.114 * (p[2] as f32);
        }
        let mean = (sum_luma / total_pixels + 0.5).floor();

        let mut out = RgbaImage::new(w, h);
        for (x, y, p) in image.enumerate_pixels() {
            let nr = (mean + ((p[0] as f32) - mean) * factor)
                .round()
                .clamp(0.0, 255.0) as u8;
            let ng = (mean + ((p[1] as f32) - mean) * factor)
                .round()
                .clamp(0.0, 255.0) as u8;
            let nb = (mean + ((p[2] as f32) - mean) * factor)
                .round()
                .clamp(0.0, 255.0) as u8;
            out.put_pixel(x, y, Rgba([nr, ng, nb, p[3]]));
        }
        out
    }

    /// Matches PIL's `ImageEnhance.Sharpness`: interpolates between a 3x3 SMOOTH kernel and original image.
    fn enhance_sharpness(image: &RgbaImage, factor: f32) -> RgbaImage {
        if (factor - 1.0).abs() <= f32::EPSILON {
            return image.clone();
        }
        let (w, h) = image.dimensions();
        if w < 3 || h < 3 {
            return image.clone();
        }

        const KERNEL: [[f32; 3]; 3] = [[1.0, 1.0, 1.0], [1.0, 5.0, 1.0], [1.0, 1.0, 1.0]];
        const DIV: f32 = 13.0;

        let mut out = image.clone();
        for y in 1..(h - 1) {
            for x in 1..(w - 1) {
                let mut smooth = [0.0_f32; 3];
                for ky in 0..3 {
                    for kx in 0..3 {
                        let px = image.get_pixel(x + kx as u32 - 1, y + ky as u32 - 1);
                        let weight = KERNEL[ky][kx];
                        smooth[0] += (px[0] as f32) * weight;
                        smooth[1] += (px[1] as f32) * weight;
                        smooth[2] += (px[2] as f32) * weight;
                    }
                }
                let orig = image.get_pixel(x, y);
                let mut res = [orig[0], orig[1], orig[2], orig[3]];
                for c in 0..3 {
                    let s = smooth[c] / DIV;
                    let o = orig[c] as f32;
                    res[c] = (s + (o - s) * factor).round().clamp(0.0, 255.0) as u8;
                }
                out.put_pixel(x, y, Rgba(res));
            }
        }
        out
    }

    /// Matches PIL's `ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3)`
    fn unsharp_mask(image: &RgbaImage, sigma: f32, percent: f32, threshold: u8) -> RgbaImage {
        let blurred = image::imageops::blur(image, sigma);
        let (w, h) = image.dimensions();
        let mut out = RgbaImage::new(w, h);
        let scale = percent / 100.0;

        for y in 0..h {
            for x in 0..w {
                let orig = image.get_pixel(x, y);
                let blur = blurred.get_pixel(x, y);
                let mut px = [orig[0], orig[1], orig[2], orig[3]];

                for c in 0..3 {
                    let diff = (orig[c] as i32) - (blur[c] as i32);
                    if diff.unsigned_abs() as u8 >= threshold {
                        let val = (orig[c] as f32) + (diff as f32) * scale;
                        px[c] = val.round().clamp(0.0, 255.0) as u8;
                    }
                }
                out.put_pixel(x, y, Rgba(px));
            }
        }
        out
    }

    /// Losslessly zeroes RGB channels wherever alpha == 0 so Deflate/Zopfli achieves higher compression ratios.
    fn clean_transparent_pixels(image: &RgbaImage) -> Vec<u8> {
        let raw = image.as_raw();
        let mut cleaned = Vec::with_capacity(raw.len());
        for px in raw.chunks_exact(4) {
            if px[3] == 0 {
                cleaned.extend_from_slice(&[0, 0, 0, 0]);
            } else {
                cleaned.extend_from_slice(px);
            }
        }
        cleaned
    }

    /// Composites an RGBA image over a solid RGB background color for JPEG export.
    fn composite_onto_rgb(image: &RgbaImage, bg: [u8; 3]) -> RgbImage {
        let (w, h) = image.dimensions();
        let mut rgb = RgbImage::new(w, h);
        let bg_r = bg[0] as f32;
        let bg_g = bg[1] as f32;
        let bg_b = bg[2] as f32;

        for (x, y, p) in image.enumerate_pixels() {
            let a = (p[3] as f32) / 255.0;
            let inv_a = 1.0 - a;
            let r = ((p[0] as f32) * a + bg_r * inv_a).round().clamp(0.0, 255.0) as u8;
            let g = ((p[1] as f32) * a + bg_g * inv_a).round().clamp(0.0, 255.0) as u8;
            let b = ((p[2] as f32) * a + bg_b * inv_a).round().clamp(0.0, 255.0) as u8;
            rgb.put_pixel(x, y, image::Rgb([r, g, b]));
        }
        rgb
    }

    fn encode_png_with_mode(
        image: &RgbaImage,
        compression: CompressionMode,
    ) -> Result<Vec<u8>, DomainError> {
        let (w, h) = image.dimensions();
        let cleaned_raw = Self::clean_transparent_pixels(image);

        if compression == CompressionMode::Png8Quant {
            let mut liq = imagequant::new();
            let _ = liq.set_speed(3);
            let _ = liq.set_quality(0, 96);

            let rgba_pixels: Vec<imagequant::RGBA> = cleaned_raw
                .chunks_exact(4)
                .map(|c| imagequant::RGBA::new(c[0], c[1], c[2], c[3]))
                .collect();

            if let Ok(mut img_liq) = liq.new_image(rgba_pixels, w as usize, h as usize, 0.0) {
                if let Ok(mut res) = liq.quantize(&mut img_liq) {
                    let _ = res.set_dithering_level(1.0);
                    if let Ok((palette, pixels)) = res.remapped(&mut img_liq) {
                        let mut pal_rgb = Vec::with_capacity(palette.len() * 3);
                        let mut pal_alpha = Vec::with_capacity(palette.len());
                        for color in &palette {
                            pal_rgb.push(color.r);
                            pal_rgb.push(color.g);
                            pal_rgb.push(color.b);
                            pal_alpha.push(color.a);
                        }

                        let mut png_buf = Vec::new();
                        {
                            let mut encoder = Encoder::new(Cursor::new(&mut png_buf), w, h);
                            encoder.set_color(ColorType::Indexed);
                            encoder.set_depth(BitDepth::Eight);
                            encoder.set_compression(Compression::Best);
                            encoder.set_palette(pal_rgb);
                            encoder.set_trns(pal_alpha);

                            let mut writer = encoder.write_header().map_err(|e| {
                                DomainError::ImageProcessingError(format!(
                                    "PNG-8 header write error: {e}"
                                ))
                            })?;
                            writer.write_image_data(&pixels).map_err(|e| {
                                DomainError::ImageProcessingError(format!(
                                    "PNG-8 data write error: {e}"
                                ))
                            })?;
                        }

                        // Further optimize the indexed PNG losslessly with OxiPNG preset 2
                        let mut oxi_opts = OxiOptions::from_preset(2);
                        oxi_opts.strip = StripChunks::Safe;
                        if let Ok(optimized) = oxipng::optimize_from_memory(&png_buf, &oxi_opts) {
                            return Ok(optimized);
                        }
                        return Ok(png_buf);
                    }
                }
            }
        }

        if compression == CompressionMode::None {
            let mut base_png = Vec::new();
            {
                let mut encoder = Encoder::new(Cursor::new(&mut base_png), w, h);
                encoder.set_color(ColorType::Rgba);
                encoder.set_depth(BitDepth::Eight);
                encoder.set_compression(Compression::Fast);
                encoder.set_filter(PngFilterType::Sub);

                let mut writer = encoder.write_header().map_err(|e| {
                    DomainError::ImageProcessingError(format!("PNG header write error: {e}"))
                })?;
                writer.write_image_data(&cleaned_raw).map_err(|e| {
                    DomainError::ImageProcessingError(format!("PNG data write error: {e}"))
                })?;
            }
            return Ok(base_png);
        }

        // Apply OxiPNG lossless optimization directly on raw RGBA buffer (multi-threaded across CPU cores)
        let oxi_options = match compression {
            CompressionMode::None => unreachable!(),
            CompressionMode::LosslessFast => {
                let mut opts = OxiOptions::from_preset(1);
                opts.optimize_alpha = true;
                opts.strip = StripChunks::Safe;
                opts
            }
            CompressionMode::LosslessBalanced | CompressionMode::Png8Quant => {
                let mut opts = OxiOptions::from_preset(2);
                opts.optimize_alpha = true;
                opts.strip = StripChunks::Safe;
                opts
            }
            CompressionMode::LosslessMax => {
                let mut opts = OxiOptions::from_preset(5);
                opts.optimize_alpha = true;
                opts.strip = StripChunks::Safe;
                opts
            }
            CompressionMode::LosslessZopfli => {
                let mut opts = OxiOptions::from_preset(3);
                opts.optimize_alpha = true;
                opts.strip = StripChunks::Safe;
                opts.deflate = Deflaters::Zopfli {
                    iterations: NonZeroU8::new(10).unwrap(),
                };
                opts
            }
        };

        if let Ok(raw_img) = RawImage::new(
            w,
            h,
            OxiColorType::RGBA,
            OxiBitDepth::Eight,
            cleaned_raw.clone(),
        ) {
            if let Ok(optimized) = raw_img.create_optimized_png(&oxi_options) {
                return Ok(optimized);
            }
        }

        // Fallback if RawImage optimization fails
        let mut base_png = Vec::new();
        {
            let mut encoder = Encoder::new(Cursor::new(&mut base_png), w, h);
            encoder.set_color(ColorType::Rgba);
            encoder.set_depth(BitDepth::Eight);
            encoder.set_compression(Compression::Fast);
            let mut writer = encoder.write_header().map_err(|e| {
                DomainError::ImageProcessingError(format!("PNG header write error: {e}"))
            })?;
            writer.write_image_data(&cleaned_raw).map_err(|e| {
                DomainError::ImageProcessingError(format!("PNG data write error: {e}"))
            })?;
        }
        Ok(base_png)
    }
}

impl Default for NativeImageProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl ImageProcessorOutputPort for NativeImageProcessor {
    fn decode_image(&self, bytes: &[u8]) -> Result<RgbaImage, DomainError> {
        let dyn_img = image::load_from_memory(bytes)
            .map_err(|e| DomainError::InvalidImage(e.to_string()))?;
        Ok(dyn_img.to_rgba8())
    }

    fn upscale_and_deblur(&self, image: &RgbaImage, config: &UpscaleConfig) -> RgbaImage {
        if !config.enabled {
            return image.clone();
        }

        let (orig_w, orig_h) = image.dimensions();
        if orig_w == 0 || orig_h == 0 {
            return image.clone();
        }

        let factor = config.scale_factor.clamp(2, 4);
        let max_dim: u32 = 3840;
        let raw_w = orig_w.saturating_mul(factor);
        let raw_h = orig_h.saturating_mul(factor);
        let (target_w, target_h) = if raw_w > max_dim || raw_h > max_dim {
            let scale = (max_dim as f32) / (raw_w.max(raw_h) as f32);
            (
                ((raw_w as f32) * scale).round().max(1.0) as u32,
                ((raw_h as f32) * scale).round().max(1.0) as u32,
            )
        } else {
            (raw_w.max(1), raw_h.max(1))
        };

        let denoise = config.denoise_strength.clamp(0.0, 1.0);
        let deblur = config.deblur_strength.clamp(0.0, 1.0);

        // Stage 1: Pre-upscale Edge-Preserving Bilateral De-Blocking on the low-res input.
        // Strips JPEG 8x8 mosquito/block noise before super-resolution so noise is never sharpened.
        let clean_low = if denoise > 0.02 && orig_w >= 3 && orig_h >= 3 {
            let mut filtered = image.clone();
            let sigma_c = 10.0 + denoise * 28.0;
            let two_sigma_sq = 2.0 * sigma_c * sigma_c;
            let w_usize = orig_w as usize;
            let src = image.as_raw();
            let dst = filtered.as_mut();

            for y in 1..(orig_h as usize - 1) {
                for x in 1..(orig_w as usize - 1) {
                    let c_idx = (y * w_usize + x) * 4;
                    let ca = src[c_idx + 3];
                    if ca == 0 {
                        continue;
                    }
                    let cr = src[c_idx] as f32;
                    let cg = src[c_idx + 1] as f32;
                    let cb = src[c_idx + 2] as f32;

                    let mut sum_r = cr;
                    let mut sum_g = cg;
                    let mut sum_b = cb;
                    let mut sum_w = 1.0_f32;

                    for dy in -1isize..=1 {
                        for dx in -1isize..=1 {
                            if dx == 0 && dy == 0 {
                                continue;
                            }
                            let ny = (y as isize + dy) as usize;
                            let nx = (x as isize + dx) as usize;
                            let n_idx = (ny * w_usize + nx) * 4;
                            if src[n_idx + 3] == 0 {
                                continue;
                            }
                            let nr = src[n_idx] as f32;
                            let ng = src[n_idx + 1] as f32;
                            let nb = src[n_idx + 2] as f32;
                            let d2 = (nr - cr).powi(2) + (ng - cg).powi(2) + (nb - cb).powi(2);
                            let spatial_w = if dx == 0 || dy == 0 { 0.65 } else { 0.45 };
                            let w_val = spatial_w * (-d2 / two_sigma_sq).exp();
                            sum_r += nr * w_val;
                            sum_g += ng * w_val;
                            sum_b += nb * w_val;
                            sum_w += w_val;
                        }
                    }

                    let blend = denoise * 0.85;
                    let br = sum_r / sum_w;
                    let bg = sum_g / sum_w;
                    let bb = sum_b / sum_w;
                    dst[c_idx] = (cr + (br - cr) * blend).round().clamp(0.0, 255.0) as u8;
                    dst[c_idx + 1] = (cg + (bg - cg) * blend).round().clamp(0.0, 255.0) as u8;
                    dst[c_idx + 2] = (cb + (bb - cb) * blend).round().clamp(0.0, 255.0) as u8;
                }
            }
            filtered
        } else {
            image.clone()
        };

        // Stage 2: Lanczos-3 Super-Resolution + Iterative Back-Projection (IBP) residual recovery
        let mut upscaled =
            image::imageops::resize(&clean_low, target_w, target_h, FilterType::Lanczos3);

        if deblur > 0.02 && target_w >= 4 && target_h >= 4 {
            // Downsample the upscaled estimate back to low-res to measure interpolation blur loss
            let down_est =
                image::imageops::resize(&upscaled, orig_w, orig_h, FilterType::Triangle);

            // Store signed residual error per pixel centered at 128: err = clamp(128 + (clean_low - down_est), 0..255)
            let mut err_low = RgbaImage::new(orig_w, orig_h);
            for (el, (cl, de)) in err_low
                .pixels_mut()
                .zip(clean_low.pixels().zip(down_est.pixels()))
            {
                let er = (128 + (cl[0] as i32) - (de[0] as i32)).clamp(0, 255) as u8;
                let eg = (128 + (cl[1] as i32) - (de[1] as i32)).clamp(0, 255) as u8;
                let eb = (128 + (cl[2] as i32) - (de[2] as i32)).clamp(0, 255) as u8;
                let ea = (128 + (cl[3] as i32) - (de[3] as i32)).clamp(0, 255) as u8;
                *el = Rgba([er, eg, eb, ea]);
            }

            let err_up =
                image::imageops::resize(&err_low, target_w, target_h, FilterType::Triangle);
            let ibp_gain = 0.45 + 0.55 * deblur;

            for (up_px, err_px) in upscaled.pixels_mut().zip(err_up.pixels()) {
                for c in 0..4 {
                    let delta = ((err_px[c] as i32) - 128) as f32;
                    up_px[c] = ((up_px[c] as f32) + delta * ibp_gain)
                        .round()
                        .clamp(0.0, 255.0) as u8;
                }
            }

            // Stage 3: Halo-Free Contrast Adaptive Sharpening (CAS) + S-Curve Edge De-Blurring
            // Snaps blurry 3-5px interpolation ramps into crisp 1-2px contours while clamping strictly
            // to the local 3x3 [min, max] neighborhood so zero white/black halos are ever introduced.
            let mut final_img = upscaled.clone();
            let tw = target_w as usize;
            let th = target_h as usize;
            let src = upscaled.as_raw();
            let dst = final_img.as_mut();

            let shock_blend = (deblur * 0.72).clamp(0.0, 0.78);
            let cas_strength = (deblur * 0.85).clamp(0.0, 0.90);

            for y in 1..(th - 1) {
                for x in 1..(tw - 1) {
                    let idx = (y * tw + x) * 4;
                    let center_a = src[idx + 3];
                    if center_a == 0 {
                        continue;
                    }

                    let top_idx = ((y - 1) * tw + x) * 4;
                    let bot_idx = ((y + 1) * tw + x) * 4;
                    let lft_idx = (y * tw + (x - 1)) * 4;
                    let rgt_idx = (y * tw + (x + 1)) * 4;

                    for c in 0..3 {
                        let mut min_c = 255u8;
                        let mut max_c = 0u8;
                        for dy in -1isize..=1 {
                            let row_off = ((y as isize + dy) as usize) * tw;
                            for dx in -1isize..=1 {
                                let n_idx = (row_off + (x as isize + dx) as usize) * 4;
                                let val = src[n_idx + c];
                                if val < min_c {
                                    min_c = val;
                                }
                                if val > max_c {
                                    max_c = val;
                                }
                            }
                        }

                        let span = (max_c - min_c) as f32;
                        if span < 6.0 {
                            continue;
                        }

                        let center_v = src[idx + c] as f32;
                        let cross_avg = (src[top_idx + c] as f32
                            + src[bot_idx + c] as f32
                            + src[lft_idx + c] as f32
                            + src[rgt_idx + c] as f32)
                            * 0.25;

                        // CAS high-pass detail boost
                        let detail = center_v - cross_avg;
                        let cas_val = center_v + detail * (1.25 * cas_strength);

                        // Normalized position inside local 3x3 [min_c, max_c]
                        let t = ((cas_val - (min_c as f32)) / span).clamp(0.0, 1.0);
                        // Smoothstep S-curve steepens blurry edge transition ramps toward crisp boundaries
                        let s_curve = t * t * (3.0 - 2.0 * t);
                        let shocked_t = t + (s_curve - t) * shock_blend;
                        let out_v = (min_c as f32) + shocked_t * span;

                        // Strictly clamp to [min_c, max_c] -> 100% halo-free guarantee
                        dst[idx + c] = out_v.round().clamp(min_c as f32, max_c as f32) as u8;
                    }

                    // Also crisp up semi-transparent alpha edges if the input already had transparency
                    let mut min_a = 255u8;
                    let mut max_a = 0u8;
                    for dy in -1isize..=1 {
                        let row_off = ((y as isize + dy) as usize) * tw;
                        for dx in -1isize..=1 {
                            let a_val = src[(row_off + (x as isize + dx) as usize) * 4 + 3];
                            if a_val < min_a {
                                min_a = a_val;
                            }
                            if a_val > max_a {
                                max_a = a_val;
                            }
                        }
                    }
                    let span_a = (max_a - min_a) as f32;
                    if span_a >= 12.0 {
                        let ta = (((center_a as f32) - (min_a as f32)) / span_a).clamp(0.0, 1.0);
                        let sa = ta * ta * (3.0 - 2.0 * ta);
                        let out_a = (min_a as f32) + (ta + (sa - ta) * shock_blend) * span_a;
                        dst[idx + 3] = out_a.round().clamp(min_a as f32, max_a as f32) as u8;
                    }
                }
            }

            return final_img;
        }

        upscaled
    }

    fn adjust_image(
        &self,
        image: &RgbaImage,
        brightness: f32,
        saturation: f32,
        sharpness: f32,
    ) -> RgbaImage {
        let mut current = image.clone();
        if (brightness - 1.0).abs() > f32::EPSILON {
            current = Self::enhance_brightness(&current, brightness);
        }
        if (saturation - 1.0).abs() > f32::EPSILON {
            current = Self::enhance_saturation(&current, saturation);
        }
        if (sharpness - 1.0).abs() > f32::EPSILON {
            current = Self::enhance_sharpness(&current, sharpness);
        }
        current
    }

    fn beautify(&self, image: &RgbaImage) -> RgbaImage {
        let img = Self::enhance_saturation(image, 1.2);
        let img = Self::enhance_contrast(&img, 1.15);
        let img = Self::enhance_sharpness(&img, 1.5);
        Self::unsharp_mask(&img, 2.0, 150.0, 3)
    }

    fn apply_mask(
        &self,
        image: &RgbaImage,
        mask: &GrayImage,
        _composite_cutout: bool,
    ) -> Result<RgbaImage, DomainError> {
        let (w, h) = image.dimensions();
        let (mw, mh) = mask.dimensions();
        if w != mw || h != mh {
            return Err(DomainError::ImageProcessingError(format!(
                "La máscara ({mw}x{mh}) y la imagen ({w}x{h}) no tienen el mismo tamaño"
            )));
        }

        // Preserve straight (unpremultiplied) RGB values for all non-zero alpha pixels
        // so edges never get darkened toward black [0,0,0].
        let mut out = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let px = image.get_pixel(x, y);
                let m = mask.get_pixel(x, y)[0];
                let a = ((px[3] as u32 * m as u32 + 127) / 255) as u8;
                if a == 0 {
                    out.put_pixel(x, y, Rgba([0, 0, 0, 0]));
                } else {
                    out.put_pixel(x, y, Rgba([px[0], px[1], px[2], a]));
                }
            }
        }
        Ok(out)
    }

    fn refine_mask_with_sobel(&self, _original: &RgbaImage, masked: &RgbaImage) -> RgbaImage {
        let (w, h) = masked.dimensions();
        if w < 3 || h < 3 {
            return masked.clone();
        }

        let w_usize = w as usize;
        let h_usize = h as usize;

        let mut alpha = vec![0_u8; w_usize * h_usize];
        for y in 0..h_usize {
            for x in 0..w_usize {
                alpha[y * w_usize + x] = masked.get_pixel(x as u32, y as u32)[3];
            }
        }

        let mut refined_alpha = alpha.clone();
        let radius: isize = 2;
        let two_sigma_space_sq = 2.0 * 75.0_f32 * 75.0_f32;
        let two_sigma_color_sq = 2.0 * 75.0_f32 * 75.0_f32;

        let mut spatial_weights = [[0.0_f32; 5]; 5];
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let dist_sq = (dx * dx + dy * dy) as f32;
                spatial_weights[(dy + radius) as usize][(dx + radius) as usize] =
                    (-dist_sq / two_sigma_space_sq).exp();
            }
        }

        let mut color_lut = [0.0_f32; 256];
        for (diff, slot) in color_lut.iter_mut().enumerate() {
            let d = diff as f32;
            *slot = (-(d * d) / two_sigma_color_sq).exp();
        }

        for y in 0..h_usize {
            for x in 0..w_usize {
                let center_a = alpha[y * w_usize + x];
                if y >= 2 && y + 2 < h_usize && x >= 2 && x + 2 < w_usize {
                    let mut uniform = true;
                    'check: for dy in -2isize..=2 {
                        for dx in -2isize..=2 {
                            if alpha[((y as isize + dy) as usize) * w_usize
                                + ((x as isize + dx) as usize)]
                                != center_a
                            {
                                uniform = false;
                                break 'check;
                            }
                        }
                    }
                    if uniform {
                        continue;
                    }
                }

                let mut sum_val = 0.0_f32;
                let mut sum_w = 0.0_f32;

                let y_min = (y as isize - radius).max(0) as usize;
                let y_max = (y as isize + radius).min(h_usize as isize - 1) as usize;
                let x_min = (x as isize - radius).max(0) as usize;
                let x_max = (x as isize + radius).min(w_usize as isize - 1) as usize;

                for ny in y_min..=y_max {
                    let wy_idx = (ny as isize - y as isize + radius) as usize;
                    for nx in x_min..=x_max {
                        let wx_idx = (nx as isize - x as isize + radius) as usize;
                        let neigh_a = alpha[ny * w_usize + nx];
                        let diff_abs = neigh_a.abs_diff(center_a) as usize;
                        let w_total = spatial_weights[wy_idx][wx_idx] * color_lut[diff_abs];

                        sum_val += (neigh_a as f32) * w_total;
                        sum_w += w_total;
                    }
                }

                let filtered = (sum_val / sum_w.max(1e-6)) as u8;
                refined_alpha[y * w_usize + x] = filtered;
            }
        }

        let mut out = masked.clone();
        for y in 0..h_usize {
            for x in 0..w_usize {
                let mut px = *out.get_pixel(x as u32, y as u32);
                px[3] = refined_alpha[y * w_usize + x];
                out.put_pixel(x as u32, y as u32, px);
            }
        }
        out
    }

    fn auto_crop(&self, image: &RgbaImage) -> RgbaImage {
        let (w, h) = image.dimensions();
        let mut min_x = w;
        let mut min_y = h;
        let mut max_x = 0;
        let mut max_y = 0;
        let mut found = false;

        for (x, y, p) in image.enumerate_pixels() {
            if p[3] > 0 {
                found = true;
                if x < min_x {
                    min_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if x > max_x {
                    max_x = x;
                }
                if y > max_y {
                    max_y = y;
                }
            }
        }

        let cropped = if found {
            let crop_w = max_x - min_x + 1;
            let crop_h = max_y - min_y + 1;
            image::imageops::crop_imm(image, min_x, min_y, crop_w, crop_h).to_image()
        } else {
            image.clone()
        };

        let (cw, ch) = cropped.dimensions();
        if cw == ch {
            return cropped;
        }

        let new_size = cw.max(ch);
        let mut square = RgbaImage::from_pixel(new_size, new_size, Rgba([0, 0, 0, 0]));
        let left = (new_size - cw) / 2;
        let top = (new_size - ch) / 2;
        image::imageops::overlay(&mut square, &cropped, left as i64, top as i64);
        square
    }

    fn resize(&self, image: &RgbaImage, mode: &ProcessingMode) -> RgbaImage {
        match *mode {
            ProcessingMode::Original => image.clone(),
            ProcessingMode::Custom { width, height } => {
                image::imageops::resize(image, width, height, FilterType::Lanczos3)
            }
            ProcessingMode::Optimized => {
                let (orig_w, orig_h) = image.dimensions();
                let max_dim: u32 = 500;
                let (new_w, new_h) = if orig_w > orig_h {
                    let nh = (((max_dim as f32) / (orig_w as f32)) * (orig_h as f32)) as u32;
                    (max_dim, nh.max(1))
                } else {
                    let nw = (((max_dim as f32) / (orig_h as f32)) * (orig_w as f32)) as u32;
                    (nw.max(1), max_dim)
                };
                image::imageops::resize(image, new_w, new_h, FilterType::Lanczos3)
            }
        }
    }

    fn encode_image(
        &self,
        image: &RgbaImage,
        format: OutputFormat,
        compression: CompressionMode,
        jpg_quality: u8,
        jpg_background: [u8; 3],
    ) -> Result<Vec<u8>, DomainError> {
        match format {
            OutputFormat::Jpg => {
                let rgb = Self::composite_onto_rgb(image, jpg_background);
                let effective_quality = match compression {
                    CompressionMode::LosslessMax | CompressionMode::LosslessZopfli => 100,
                    CompressionMode::LosslessBalanced | CompressionMode::LosslessFast => {
                        jpg_quality.max(96)
                    }
                    _ => jpg_quality.clamp(10, 100),
                };

                let mut jpg_buf = Vec::new();
                let mut encoder =
                    JpegEncoder::new_with_quality(Cursor::new(&mut jpg_buf), effective_quality);
                encoder
                    .encode_image(&rgb)
                    .map_err(|e| DomainError::ImageProcessingError(format!("JPEG encode error: {e}")))?;
                Ok(jpg_buf)
            }
            _ => Self::encode_png_with_mode(image, compression),
        }
    }

    fn encode_png(
        &self,
        image: &RgbaImage,
        compress: bool,
        optimize: bool,
    ) -> Result<Vec<u8>, DomainError> {
        let mode = if compress {
            CompressionMode::Png8Quant
        } else if optimize {
            CompressionMode::LosslessBalanced
        } else {
            CompressionMode::None
        };
        Self::encode_png_with_mode(image, mode)
    }

    fn vectorize_to_svg(
        &self,
        image: &RgbaImage,
        config: &VectorizeConfig,
    ) -> Result<String, DomainError> {
        let (orig_w, orig_h) = image.dimensions();
        let max_trace_dim: u32 = 1200;
        let working_img = if orig_w > max_trace_dim || orig_h > max_trace_dim {
            let scale = (max_trace_dim as f32) / (orig_w.max(orig_h) as f32);
            let nw = ((orig_w as f32) * scale).round().max(1.0) as u32;
            let nh = ((orig_h as f32) * scale).round().max(1.0) as u32;
            image::imageops::resize(image, nw, nh, FilterType::Triangle)
        } else {
            image.clone()
        };

        let (w, h) = working_img.dimensions();

        // Determine the color to omit completely from the SVG (if enabled)
        let target_ignore_rgb: Option<[u8; 3]> = if config.ignore_color_enabled {
            if config.ignore_color_auto {
                let mut r_sum = 0u64;
                let mut g_sum = 0u64;
                let mut b_sum = 0u64;
                let mut count = 0u64;
                for x in 0..w {
                    for &y in &[0, h.saturating_sub(1)] {
                        let p = working_img.get_pixel(x, y);
                        if p[3] >= 180 {
                            r_sum += p[0] as u64;
                            g_sum += p[1] as u64;
                            b_sum += p[2] as u64;
                            count += 1;
                        }
                    }
                }
                for y in 0..h {
                    for &x in &[0, w.saturating_sub(1)] {
                        let p = working_img.get_pixel(x, y);
                        if p[3] >= 180 {
                            r_sum += p[0] as u64;
                            g_sum += p[1] as u64;
                            b_sum += p[2] as u64;
                            count += 1;
                        }
                    }
                }
                if count > 0 {
                    Some([
                        (r_sum / count) as u8,
                        (g_sum / count) as u8,
                        (b_sum / count) as u8,
                    ])
                } else {
                    Some(config.ignore_color)
                }
            } else {
                Some(config.ignore_color)
            }
        } else {
            None
        };

        let tol = config.ignore_tolerance as f32;
        // Max squared Euclidean distance in RGB space for omitting the target color
        let ignore_dist_sq = (tol * 1.732_05).powi(2);

        let is_omitted_color = |r: u8, g: u8, b: u8| -> bool {
            if let Some([ir, ig, ib]) = target_ignore_rgb {
                let dr = (r as f32) - (ir as f32);
                let dg = (g as f32) - (ig as f32);
                let db = (b as f32) - (ib as f32);
                (dr * dr + dg * dg + db * db) <= ignore_dist_sq
            } else {
                false
            }
        };

        // Step 1: Harden semi-transparent anti-aliased edges (alpha < 175 -> 0) and strip omitted color pixels
        // Semi-transparent edge pixels are the #1 cause of noisy border slivers in vector tracing.
        let mut cleaned = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let p = working_img.get_pixel(x, y);
                if p[3] < 175 || is_omitted_color(p[0], p[1], p[2]) {
                    cleaned.put_pixel(x, y, Rgba([0, 0, 0, 0]));
                } else {
                    cleaned.put_pixel(x, y, Rgba([p[0], p[1], p[2], 255]));
                }
            }
        }

        // Step 2: De-halo & replace contaminated 1px border fringe pixels with interior opaque neighbor color,
        // and discard isolated 1-2px noise specks before tracing.
        let mut dehaloed = cleaned.clone();
        for y in 1..h.saturating_sub(1) {
            for x in 1..w.saturating_sub(1) {
                let cur = cleaned.get_pixel(x, y);
                if cur[3] == 0 {
                    continue;
                }

                let mut opaque_neighbors = 0u32;
                let mut interior_r = 0u32;
                let mut interior_g = 0u32;
                let mut interior_b = 0u32;
                let mut interior_count = 0u32;

                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let np = cleaned.get_pixel((x as i32 + dx) as u32, (y as i32 + dy) as u32);
                        if np[3] == 255 {
                            opaque_neighbors += 1;
                            // Check if this neighbor is deeper inside the shape
                            interior_r += np[0] as u32;
                            interior_g += np[1] as u32;
                            interior_b += np[2] as u32;
                            interior_count += 1;
                        }
                    }
                }

                // Remove isolated 1-2 pixel border burrs/noise
                if opaque_neighbors <= 2 {
                    dehaloed.put_pixel(x, y, Rgba([0, 0, 0, 0]));
                } else if opaque_neighbors < 8 && interior_count > 0 {
                    // Border pixel touching transparency: snap its RGB toward interior average to eliminate edge color fringe
                    let avg_r = (interior_r / interior_count) as u8;
                    let avg_g = (interior_g / interior_count) as u8;
                    let avg_b = (interior_b / interior_count) as u8;
                    if is_omitted_color(avg_r, avg_g, avg_b) {
                        dehaloed.put_pixel(x, y, Rgba([0, 0, 0, 0]));
                    } else {
                        dehaloed.put_pixel(x, y, Rgba([avg_r, avg_g, avg_b, 255]));
                    }
                }
            }
        }

        // Step 3: 3x3 Edge-Preserving Bilateral Smoothing across opaque pixels only
        // Smooths JPEG artifacts and staircase jaggies without ever blending with transparent [0,0,0,0] pixels.
        let mut smoothed = dehaloed.clone();
        let color_sigma_sq = 2.0 * 28.0_f32 * 28.0_f32;
        for y in 1..h.saturating_sub(1) {
            for x in 1..w.saturating_sub(1) {
                let c = dehaloed.get_pixel(x, y);
                if c[3] == 0 {
                    continue;
                }
                let mut sum_r = 0.0_f32;
                let mut sum_g = 0.0_f32;
                let mut sum_b = 0.0_f32;
                let mut sum_w = 0.0_f32;

                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        let np = dehaloed.get_pixel((x as i32 + dx) as u32, (y as i32 + dy) as u32);
                        if np[3] == 0 {
                            continue;
                        }
                        let dr = (np[0] as f32) - (c[0] as f32);
                        let dg = (np[1] as f32) - (c[1] as f32);
                        let db = (np[2] as f32) - (c[2] as f32);
                        let d2 = dr * dr + dg * dg + db * db;
                        let spatial_w = if dx == 0 && dy == 0 { 1.0 } else { 0.65 };
                        let w_val = spatial_w * (-d2 / color_sigma_sq).exp();
                        sum_r += (np[0] as f32) * w_val;
                        sum_g += (np[1] as f32) * w_val;
                        sum_b += (np[2] as f32) * w_val;
                        sum_w += w_val;
                    }
                }

                if sum_w > 0.0 {
                    smoothed.put_pixel(
                        x,
                        y,
                        Rgba([
                            (sum_r / sum_w).round() as u8,
                            (sum_g / sum_w).round() as u8,
                            (sum_b / sum_w).round() as u8,
                            255,
                        ]),
                    );
                }
            }
        }

        // Build base VTracerConfig from Adobe Illustrator-like preset with stronger default speckle suppression
        let mut vt_cfg = match config.preset {
            TracePreset::PhotoHighFidelity => VTracerConfig {
                color_mode: ColorMode::Color,
                hierarchical: Hierarchical::Stacked,
                mode: PathSimplifyMode::Spline,
                filter_speckle: 6,
                color_precision: 8,
                layer_difference: 12,
                corner_threshold: 55,
                length_threshold: 4.0,
                splice_threshold: 45,
                max_iterations: 12,
                path_precision: Some(2),
            },
            TracePreset::IllustrationColor => VTracerConfig {
                color_mode: ColorMode::Color,
                hierarchical: Hierarchical::Stacked,
                mode: PathSimplifyMode::Spline,
                filter_speckle: 10,
                color_precision: 6,
                layer_difference: 20,
                corner_threshold: 60,
                length_threshold: 4.5,
                splice_threshold: 45,
                max_iterations: 12,
                path_precision: Some(2),
            },
            TracePreset::LowFidelityPoster => VTracerConfig {
                color_mode: ColorMode::Color,
                hierarchical: Hierarchical::Stacked,
                mode: PathSimplifyMode::Spline,
                filter_speckle: 14,
                color_precision: 4,
                layer_difference: 36,
                corner_threshold: 65,
                length_threshold: 5.0,
                splice_threshold: 45,
                max_iterations: 12,
                path_precision: Some(2),
            },
            TracePreset::BlackAndWhite => VTracerConfig {
                color_mode: ColorMode::Binary,
                hierarchical: Hierarchical::Stacked,
                mode: PathSimplifyMode::Spline,
                filter_speckle: 10,
                color_precision: 2,
                layer_difference: 16,
                corner_threshold: 60,
                length_threshold: 4.5,
                splice_threshold: 45,
                max_iterations: 12,
                path_precision: Some(2),
            },
            TracePreset::LineArt => VTracerConfig {
                color_mode: ColorMode::Color,
                hierarchical: Hierarchical::Cutout,
                mode: PathSimplifyMode::Spline,
                filter_speckle: 8,
                color_precision: 6,
                layer_difference: 18,
                corner_threshold: 50,
                length_threshold: 4.2,
                splice_threshold: 45,
                max_iterations: 12,
                path_precision: Some(2),
            },
        };

        // Apply custom overrides from UI controls
        if let Some(cm) = config.curve_mode {
            vt_cfg.mode = match cm {
                TraceCurveMode::Spline => PathSimplifyMode::Spline,
                TraceCurveMode::Polygon => PathSimplifyMode::Polygon,
                TraceCurveMode::Pixel => PathSimplifyMode::None,
            };
        }
        if let Some(cp) = config.color_precision {
            vt_cfg.color_precision = cp.clamp(1, 8);
        }
        if let Some(fs) = config.filter_speckle {
            vt_cfg.filter_speckle = fs.min(128);
        }
        if let Some(ct) = config.corner_threshold {
            vt_cfg.corner_threshold = ct.clamp(0, 180);
        }
        if let Some(lt) = config.length_threshold {
            vt_cfg.length_threshold = lt.clamp(3.5, 10.0);
        }
        if let Some(st) = config.splice_threshold {
            vt_cfg.splice_threshold = st.clamp(5, 120);
        }
        if let Some(pp) = config.path_precision {
            vt_cfg.path_precision = Some(pp.clamp(1, 5));
        }
        if let Some(ld) = config.layer_difference {
            vt_cfg.layer_difference = ld.clamp(1, 128);
        }
        if let Some(cutout) = config.hierarchical_cutout {
            vt_cfg.hierarchical = if cutout {
                Hierarchical::Cutout
            } else {
                Hierarchical::Stacked
            };
        }

        // Prepare final RGBA buffer for vtracer::ColorImage
        let mut prepared = smoothed;
        if matches!(vt_cfg.color_mode, ColorMode::Binary) {
            for p in prepared.pixels_mut() {
                if p[3] < 128 {
                    *p = Rgba([255, 255, 255, 255]);
                } else {
                    let luma =
                        0.299 * (p[0] as f32) + 0.587 * (p[1] as f32) + 0.114 * (p[2] as f32);
                    if luma > 220.0 {
                        *p = Rgba([40, 40, 40, 255]);
                    } else {
                        *p = Rgba([p[0], p[1], p[2], 255]);
                    }
                }
            }
        }

        let color_img = ColorImage {
            pixels: prepared.into_raw(),
            width: w as usize,
            height: h as usize,
        };

        let svg_file = vtracer::convert(color_img, vt_cfg).map_err(|e| {
            DomainError::ImageProcessingError(format!("SVG Image Trace failed: {e}"))
        })?;

        let raw_svg = svg_file.to_string();

        // Step 4: Post-trace SVG `<path>` filter (omits target color within tolerance)
        // AND applies custom SVG stroke / outline / fill styling configured by the user.
        let fixed_stroke_hex = format!(
            "#{:02x}{:02x}{:02x}",
            config.stroke_color[0], config.stroke_color[1], config.stroke_color[2]
        );
        let mut kept_lines = Vec::new();
        for line in raw_svg.lines() {
            let mut omit_line = false;
            let mut path_hex: Option<String> = None;

            if line.trim_start().starts_with("<path ") {
                if let Some(fill_idx) = line.find("fill=\"#") {
                    let hex_start = fill_idx + 7;
                    if line.len() >= hex_start + 6 {
                        let hex_slice = &line[hex_start..hex_start + 6];
                        path_hex = Some(format!("#{}", hex_slice));
                        if target_ignore_rgb.is_some() {
                            if let (Ok(r), Ok(g), Ok(b)) = (
                                u8::from_str_radix(&hex_slice[0..2], 16),
                                u8::from_str_radix(&hex_slice[2..4], 16),
                                u8::from_str_radix(&hex_slice[4..6], 16),
                            ) {
                                if is_omitted_color(r, g, b) {
                                    omit_line = true;
                                }
                            }
                        }
                    }
                }
            }

            if omit_line {
                continue;
            }

            if let Some(orig_hex) = path_hex {
                if config.stroke_enabled || !config.fill_enabled {
                    let stroke_hex = if config.stroke_color_auto {
                        orig_hex.as_str()
                    } else {
                        fixed_stroke_hex.as_str()
                    };
                    let old_fill_attr = format!("fill=\"{}\"", orig_hex);
                    let new_attrs = if !config.fill_enabled {
                        format!(
                            "fill=\"none\" stroke=\"{}\" stroke-width=\"{:.2}\" stroke-linejoin=\"round\" stroke-linecap=\"round\"",
                            stroke_hex,
                            config.stroke_width.max(0.5)
                        )
                    } else if config.stroke_enabled {
                        format!(
                            "fill=\"{}\" stroke=\"{}\" stroke-width=\"{:.2}\" stroke-linejoin=\"round\" stroke-linecap=\"round\"",
                            orig_hex,
                            stroke_hex,
                            config.stroke_width.max(0.2)
                        )
                    } else {
                        old_fill_attr.clone()
                    };
                    kept_lines.push(line.replacen(&old_fill_attr, &new_attrs, 1));
                    continue;
                }
            }

            kept_lines.push(line.to_string());
        }
        let filtered_svg = kept_lines.join("\n");

        // Inject viewBox so the SVG scales responsively in <img> tags and vector editors
        let target_attr = format!("width=\"{}\" height=\"{}\">", w, h);
        let replacement_attr = format!(
            "width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\">",
            orig_w, orig_h, w, h
        );
        let responsive_svg = filtered_svg.replacen(&target_attr, &replacement_attr, 1);

        Ok(responsive_svg)
    }
}
