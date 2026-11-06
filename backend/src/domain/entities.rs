use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessingMode {
    Original,
    Optimized,
    Custom { width: u32, height: u32 },
}

impl ProcessingMode {
    pub fn from_params(mode: &str, width: Option<u32>, height: Option<u32>) -> Self {
        match mode.trim().to_lowercase().as_str() {
            "custom" => {
                if let (Some(w), Some(h)) = (width, height) {
                    if w > 0 && h > 0 {
                        return ProcessingMode::Custom {
                            width: w,
                            height: h,
                        };
                    }
                }
                ProcessingMode::Original
            }
            "optimized" => ProcessingMode::Optimized,
            _ => ProcessingMode::Original,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BackgroundModel {
    U2Net,
    IsNetGeneralUse,
    Silueta,
    Sam,
}

impl BackgroundModel {
    pub fn from_str(name: &str) -> Self {
        match name.trim().to_lowercase().as_str() {
            "isnet-general-use" | "isnet" | "dis" => BackgroundModel::IsNetGeneralUse,
            "silueta" => BackgroundModel::Silueta,
            "sam" | "sam3" | "mobile_sam" => BackgroundModel::Sam,
            _ => BackgroundModel::U2Net,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            BackgroundModel::U2Net => "u2net",
            BackgroundModel::IsNetGeneralUse => "isnet-general-use",
            BackgroundModel::Silueta => "silueta",
            BackgroundModel::Sam => "sam",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    Auto,
    Png,
    Jpg,
    Svg,
}

impl OutputFormat {
    pub fn from_str(fmt: &str) -> Self {
        match fmt.trim().to_lowercase().as_str() {
            "png" => OutputFormat::Png,
            "jpg" | "jpeg" => OutputFormat::Jpg,
            "svg" | "vector" => OutputFormat::Svg,
            _ => OutputFormat::Auto,
        }
    }

    pub fn resolve(&self, input_filename: &str, remove_background: bool, vectorize_enabled: bool) -> Self {
        if vectorize_enabled || *self == OutputFormat::Svg {
            return OutputFormat::Svg;
        }
        match self {
            OutputFormat::Png => OutputFormat::Png,
            OutputFormat::Jpg => OutputFormat::Jpg,
            OutputFormat::Svg => OutputFormat::Svg,
            OutputFormat::Auto => {
                if remove_background {
                    // Preserve transparency with PNG when removing background in Auto mode
                    OutputFormat::Png
                } else {
                    let lower = input_filename.to_lowercase();
                    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
                        OutputFormat::Jpg
                    } else {
                        OutputFormat::Png
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionMode {
    None,
    LosslessFast,
    LosslessBalanced,
    LosslessMax,
    LosslessZopfli,
    Png8Quant,
}

impl CompressionMode {
    pub fn from_params(mode_str: Option<&str>, legacy_compress: bool, is_optimized_mode: bool) -> Self {
        if let Some(s) = mode_str {
            match s.trim().to_lowercase().as_str() {
                "none" | "off" | "false" => return CompressionMode::None,
                "lossless_fast" | "fast" => return CompressionMode::LosslessFast,
                "lossless_balanced" | "balanced" | "lossless" => {
                    return CompressionMode::LosslessBalanced
                }
                "lossless_max" | "max" | "exhaustive" => return CompressionMode::LosslessMax,
                "lossless_zopfli" | "zopfli" | "ultra" => return CompressionMode::LosslessZopfli,
                "png8" | "png8_quant" | "quantized" => return CompressionMode::Png8Quant,
                _ => {}
            }
        }
        if legacy_compress {
            CompressionMode::Png8Quant
        } else if is_optimized_mode {
            CompressionMode::LosslessBalanced
        } else {
            CompressionMode::None
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TracePreset {
    PhotoHighFidelity,
    IllustrationColor,
    LowFidelityPoster,
    BlackAndWhite,
    LineArt,
}

impl TracePreset {
    pub fn from_str(name: &str) -> Self {
        match name.trim().to_lowercase().as_str() {
            "high_fidelity" | "photo" | "alta_fidelidad" => TracePreset::PhotoHighFidelity,
            "poster" | "low_fidelity" | "baja_fidelidad" => TracePreset::LowFidelityPoster,
            "bw" | "binary" | "silhouette" | "blanco_negro" => TracePreset::BlackAndWhite,
            "line_art" | "technical" | "dibujo_tecnico" => TracePreset::LineArt,
            _ => TracePreset::IllustrationColor,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TraceCurveMode {
    Spline,
    Polygon,
    Pixel,
}

impl TraceCurveMode {
    pub fn from_str(name: &str) -> Self {
        match name.trim().to_lowercase().as_str() {
            "polygon" | "poligono" | "poligonal" | "linear" => TraceCurveMode::Polygon,
            "pixel" | "none" | "exact" => TraceCurveMode::Pixel,
            _ => TraceCurveMode::Spline,
        }
    }
}

#[derive(Debug, Clone)]
pub struct VectorizeConfig {
    pub enabled: bool,
    pub preset: TracePreset,
    pub curve_mode: Option<TraceCurveMode>,
    pub color_precision: Option<i32>,
    pub filter_speckle: Option<usize>,
    pub corner_threshold: Option<i32>,
    pub length_threshold: Option<f64>,
    pub splice_threshold: Option<i32>,
    pub path_precision: Option<u32>,
    pub layer_difference: Option<i32>,
    pub hierarchical_cutout: Option<bool>,
    pub stroke_enabled: bool,
    pub stroke_width: f32,
    pub stroke_color_auto: bool,
    pub stroke_color: [u8; 3],
    pub fill_enabled: bool,
    pub ignore_color_enabled: bool,
    pub ignore_color_auto: bool,
    pub ignore_color: [u8; 3],
    pub ignore_tolerance: u8,
}

impl Default for VectorizeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: TracePreset::IllustrationColor,
            curve_mode: None,
            color_precision: None,
            filter_speckle: None,
            corner_threshold: None,
            length_threshold: None,
            splice_threshold: None,
            path_precision: None,
            layer_difference: None,
            hierarchical_cutout: None,
            stroke_enabled: false,
            stroke_width: 1.5,
            stroke_color_auto: true,
            stroke_color: [15, 23, 42],
            fill_enabled: true,
            ignore_color_enabled: true,
            ignore_color_auto: false,
            ignore_color: [255, 255, 255],
            ignore_tolerance: 28,
        }
    }
}

/// Interactive point sent from the UI (Preserve = 1, Delete = 0)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractivePoint {
    pub x: f32,
    pub y: f32,
    /// `1` = Preserve (Conservar), `0` = Delete (Eliminar)
    pub label: i32,
}

#[derive(Debug, Clone)]
pub enum SamPrompt {
    Point { x: f32, y: f32, label: i32 },
    Rectangle { x1: f32, y1: f32, x2: f32, y2: f32 },
    SurfaceConfig {
        max_offset_px: u32,
        color_tolerance: u8,
    },
}

impl SamPrompt {
    pub fn build_for_image(width: u32, height: u32, include_cardboard: bool) -> Vec<SamPrompt> {
        let w = width as f32;
        let h = height as f32;
        let margin_ratio = if include_cardboard { 0.02 } else { 0.05 };
        let margin_x = (w * margin_ratio).round().max(1.0);
        let margin_y = (h * margin_ratio).round().max(1.0);

        vec![SamPrompt::Rectangle {
            x1: margin_x,
            y1: margin_y,
            x2: (w - margin_x).max(margin_x + 1.0),
            y2: (h - margin_y).max(margin_y + 1.0),
        }]
    }

    /// Converts interactive user points (which may be normalized `0.0..=1.0` or in pixel coordinates)
    /// into image-space `SamPrompt` items along with the base object bounding box and surface config.
    pub fn from_interactive_points(
        width: u32,
        height: u32,
        points: &[InteractivePoint],
        include_cardboard_box: bool,
        max_offset_px: u32,
        color_tolerance: u8,
    ) -> Vec<SamPrompt> {
        let w = width as f32;
        let h = height as f32;

        // Detect if points are normalized [0.0 .. 1.0]
        let is_normalized = points
            .iter()
            .all(|p| p.x >= 0.0 && p.x <= 1.0 && p.y >= 0.0 && p.y <= 1.0);

        let mut prompts = Self::build_for_image(width, height, include_cardboard_box);
        prompts.push(SamPrompt::SurfaceConfig {
            max_offset_px,
            color_tolerance,
        });

        for pt in points {
            let px = if is_normalized { pt.x * w } else { pt.x }.clamp(0.0, w - 1.0);
            let py = if is_normalized { pt.y * h } else { pt.y }.clamp(0.0, h - 1.0);
            let label = if pt.label > 0 { 1 } else { 0 };
            prompts.push(SamPrompt::Point {
                x: px,
                y: py,
                label,
            });
        }

        prompts
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UpscaleConfig {
    pub enabled: bool,
    pub scale_factor: u32,
    pub deblur_strength: f32,
    pub denoise_strength: f32,
}

impl Default for UpscaleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            scale_factor: 2,
            deblur_strength: 0.70,
            denoise_strength: 0.45,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProcessImageCommand {
    pub image_bytes: Vec<u8>,
    pub filename: String,
    pub mode: ProcessingMode,
    pub upscale: UpscaleConfig,
    pub beautify: bool,
    pub brightness: f32,
    pub saturation: f32,
    pub sharpness: f32,
    pub sobel_refinement: bool,
    pub remove_background: bool,
    pub bg_model: BackgroundModel,
    pub compress: bool,
    pub compression_mode: CompressionMode,
    pub output_format: OutputFormat,
    pub jpg_quality: u8,
    pub jpg_background: [u8; 3],
    pub auto_crop: bool,
    pub sam_include_cardboard: bool,
    pub sam_max_offset_px: u32,
    pub sam_color_tolerance: u8,
    pub sam_points: Vec<InteractivePoint>,
    pub vectorize: VectorizeConfig,
}

#[derive(Debug, Clone)]
pub struct ProcessedImage {
    pub bytes: Vec<u8>,
    pub content_type: String,
    pub output_filename: String,
    pub original_size: usize,
    pub processed_size: usize,
}
