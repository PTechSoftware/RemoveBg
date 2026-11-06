use image::{GrayImage, RgbaImage};

use crate::domain::entities::{
    BackgroundModel, CompressionMode, OutputFormat, ProcessImageCommand, ProcessedImage,
    ProcessingMode, SamPrompt, UpscaleConfig, VectorizeConfig,
};
use crate::domain::errors::DomainError;

/// Inbound Port (Driving Port)
/// Defines the primary use case exposed to driving adapters (e.g., Actix-Web HTTP controllers).
pub trait ProcessImageInputPort: Send + Sync {
    fn execute(&self, command: ProcessImageCommand) -> Result<ProcessedImage, DomainError>;
}

/// Outbound Port (Driven Port) for AI Background Removal via local ONNX Models.
pub trait BackgroundRemoverOutputPort: Send + Sync {
    /// Predicts an 8-bit grayscale foreground mask (0..=255) matching the input image dimensions.
    /// Supports single models (`U2Net`, `IsNetGeneralUse`, `Silueta`) and interactive `Sam` (MobileSAM).
    fn predict_mask(
        &self,
        image: &RgbaImage,
        model: BackgroundModel,
        sam_prompts: Option<&[SamPrompt]>,
    ) -> Result<GrayImage, DomainError>;

    /// Preloads standard ONNX models into memory.
    fn preload_models(&self, models: &[BackgroundModel]);
}

/// Outbound Port (Driven Port) for Computer Vision, Lossless Compression, JPG/PNG Encoding & SVG Vectorization.
pub trait ImageProcessorOutputPort: Send + Sync {
    /// Decodes raw image bytes (PNG, JPG, JPEG, WEBP) into an RGBA buffer.
    fn decode_image(&self, bytes: &[u8]) -> Result<RgbaImage, DomainError>;

    /// Upscales a low-resolution image (2x, 3x, 4x) with JPEG artifact de-blocking,
    /// Iterative Back-Projection (IBP), and Halo-Free Contrast Adaptive Sharpening + Edge De-Blurring.
    fn upscale_and_deblur(&self, image: &RgbaImage, config: &UpscaleConfig) -> RgbaImage;

    /// Adjusts brightness, saturation, and sharpness multipliers.
    fn adjust_image(
        &self,
        image: &RgbaImage,
        brightness: f32,
        saturation: f32,
        sharpness: f32,
    ) -> RgbaImage;

    /// Applies catalog beautification (+20% saturation, +15% contrast, +50% sharpness, unsharp mask).
    fn beautify(&self, image: &RgbaImage) -> RgbaImage;

    /// Applies a grayscale mask to an RGBA image.
    fn apply_mask(
        &self,
        image: &RgbaImage,
        mask: &GrayImage,
        composite_cutout: bool,
    ) -> Result<RgbaImage, DomainError>;

    /// Refines the foreground alpha mask using bilateral filtering and contour cleanup.
    fn refine_mask_with_sobel(&self, original: &RgbaImage, masked: &RgbaImage) -> RgbaImage;

    /// Trims transparent borders and pads the image centered into a square canvas.
    fn auto_crop(&self, image: &RgbaImage) -> RgbaImage;

    /// Resizes the image according to the selected `ProcessingMode` (`Original`, `Optimized`, or `Custom`).
    fn resize(&self, image: &RgbaImage, mode: &ProcessingMode) -> RgbaImage;

    /// Encodes the RGBA image into PNG or JPG bytes with advanced lossless/quantized compression options.
    fn encode_image(
        &self,
        image: &RgbaImage,
        format: OutputFormat,
        compression: CompressionMode,
        jpg_quality: u8,
        jpg_background: [u8; 3],
    ) -> Result<Vec<u8>, DomainError>;

    /// Legacy helper for encoding PNG directly.
    fn encode_png(
        &self,
        image: &RgbaImage,
        compress: bool,
        optimize: bool,
    ) -> Result<Vec<u8>, DomainError>;

    /// Converts an RGBA raster image into an Adobe Illustrator-style SVG vector string ("Calco de Imagen").
    fn vectorize_to_svg(
        &self,
        image: &RgbaImage,
        config: &VectorizeConfig,
    ) -> Result<String, DomainError>;
}
