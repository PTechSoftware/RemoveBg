use std::path::Path;
use std::sync::Arc;

use crate::domain::entities::{
    BackgroundModel, OutputFormat, ProcessImageCommand, ProcessedImage, ProcessingMode, SamPrompt,
};
use crate::domain::errors::DomainError;
use crate::domain::ports::{
    BackgroundRemoverOutputPort, ImageProcessorOutputPort, ProcessImageInputPort,
};

pub struct ProcessImageService {
    bg_remover: Arc<dyn BackgroundRemoverOutputPort>,
    image_processor: Arc<dyn ImageProcessorOutputPort>,
}

impl ProcessImageService {
    pub fn new(
        bg_remover: Arc<dyn BackgroundRemoverOutputPort>,
        image_processor: Arc<dyn ImageProcessorOutputPort>,
    ) -> Self {
        Self {
            bg_remover,
            image_processor,
        }
    }

    fn build_output_filename(original_name: &str, ext: &str) -> String {
        let stem = Path::new(original_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("image");
        format!("proc_{stem}.{ext}")
    }
}

impl ProcessImageInputPort for ProcessImageService {
    fn execute(&self, command: ProcessImageCommand) -> Result<ProcessedImage, DomainError> {
        let original_size = command.image_bytes.len();

        // Decode raw image into RGBA (supports PNG, JPG, JPEG, WEBP)
        let mut input_image = self.image_processor.decode_image(&command.image_bytes)?;

        // 0a. Super-Resolution Scale Up + De-Blurring (for low-resolution images)
        if command.upscale.enabled {
            input_image = self
                .image_processor
                .upscale_and_deblur(&input_image, &command.upscale);
        }

        // 0b. Apply manual adjustments (Brightness, Saturation, Sharpness)
        if (command.brightness - 1.0).abs() > f32::EPSILON
            || (command.saturation - 1.0).abs() > f32::EPSILON
            || (command.sharpness - 1.0).abs() > f32::EPSILON
        {
            input_image = self.image_processor.adjust_image(
                &input_image,
                command.brightness,
                command.saturation,
                command.sharpness,
            );
        }

        // 1. Beautification Agent (Optional)
        if command.beautify {
            input_image = self.image_processor.beautify(&input_image);
        }

        // 2. Background Removal & Sobel Edge Reinforcement
        let mut output_image = if command.remove_background {
            let (w, h) = input_image.dimensions();
            let masked = match command.bg_model {
                BackgroundModel::Sam => {
                    let prompts = if !command.sam_points.is_empty() {
                        SamPrompt::from_interactive_points(
                            w,
                            h,
                            &command.sam_points,
                            command.sam_include_cardboard,
                            command.sam_max_offset_px,
                            command.sam_color_tolerance,
                        )
                    } else {
                        SamPrompt::build_for_image(w, h, command.sam_include_cardboard)
                    };
                    let sam_mask = self.bg_remover.predict_mask(
                        &input_image,
                        BackgroundModel::Sam,
                        Some(&prompts),
                    )?;
                    self.image_processor
                        .apply_mask(&input_image, &sam_mask, false)?
                }
                _ => {
                    // Standard flow for U2NET, ISNet, and Silueta
                    let mask =
                        self.bg_remover
                            .predict_mask(&input_image, command.bg_model, None)?;
                    self.image_processor
                        .apply_mask(&input_image, &mask, true)?
                }
            };

            // 3. Sobel Edge Reinforcement
            if command.sobel_refinement {
                self.image_processor
                    .refine_mask_with_sobel(&input_image, &masked)
            } else {
                masked
            }
        } else {
            input_image
        };

        // 4. Auto Crop (Optional)
        if command.auto_crop {
            output_image = self.image_processor.auto_crop(&output_image);
        }

        // 5. Handle Resizing (Original, Optimized ~500px, or Custom WxH)
        // When Scale Up is active, preserve the upscaled resolution instead of shrinking back to 500px in Optimized mode.
        let effective_mode = if command.upscale.enabled && command.mode == ProcessingMode::Optimized {
            ProcessingMode::Original
        } else {
            command.mode.clone()
        };
        output_image = self.image_processor.resize(&output_image, &effective_mode);

        // 6. Output Encoding or Adobe Illustrator-style Vectorization ("Calco de Imagen")
        let target_format = command.output_format.resolve(
            &command.filename,
            command.remove_background,
            command.vectorize.enabled,
        );

        match target_format {
            OutputFormat::Svg => {
                let svg_string = self
                    .image_processor
                    .vectorize_to_svg(&output_image, &command.vectorize)?;
                let bytes = svg_string.into_bytes();
                let processed_size = bytes.len();
                Ok(ProcessedImage {
                    bytes,
                    content_type: "image/svg+xml".to_string(),
                    output_filename: Self::build_output_filename(&command.filename, "svg"),
                    original_size,
                    processed_size,
                })
            }
            OutputFormat::Jpg => {
                let bytes = self.image_processor.encode_image(
                    &output_image,
                    OutputFormat::Jpg,
                    command.compression_mode,
                    command.jpg_quality,
                    command.jpg_background,
                )?;
                let processed_size = bytes.len();
                Ok(ProcessedImage {
                    bytes,
                    content_type: "image/jpeg".to_string(),
                    output_filename: Self::build_output_filename(&command.filename, "jpg"),
                    original_size,
                    processed_size,
                })
            }
            _ => {
                let bytes = self.image_processor.encode_image(
                    &output_image,
                    OutputFormat::Png,
                    command.compression_mode,
                    command.jpg_quality,
                    command.jpg_background,
                )?;
                let processed_size = bytes.len();
                Ok(ProcessedImage {
                    bytes,
                    content_type: "image/png".to_string(),
                    output_filename: Self::build_output_filename(&command.filename, "png"),
                    original_size,
                    processed_size,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::{
        CompressionMode, InteractivePoint, ProcessingMode, TracePreset, UpscaleConfig,
        VectorizeConfig,
    };
    use crate::infrastructure::image_processing::native_image_processor::NativeImageProcessor;
    use image::{GrayImage, Luma, Rgba, RgbaImage};

    struct MockBackgroundRemover;

    impl BackgroundRemoverOutputPort for MockBackgroundRemover {
        fn predict_mask(
            &self,
            image: &RgbaImage,
            _model: BackgroundModel,
            _sam_prompts: Option<&[SamPrompt]>,
        ) -> Result<GrayImage, DomainError> {
            let (w, h) = image.dimensions();
            let mut mask = GrayImage::new(w, h);
            for y in (h / 4)..(3 * h / 4) {
                for x in (w / 4)..(3 * w / 4) {
                    mask.put_pixel(x, y, Luma([255]));
                }
            }
            Ok(mask)
        }

        fn preload_models(&self, _models: &[BackgroundModel]) {}
    }

    #[test]
    fn test_hexagonal_pipeline_png_lossless_and_jpg_and_svg() {
        let processor: Arc<dyn ImageProcessorOutputPort> = Arc::new(NativeImageProcessor::new());
        let bg_remover: Arc<dyn BackgroundRemoverOutputPort> = Arc::new(MockBackgroundRemover);
        let service = ProcessImageService::new(bg_remover, Arc::clone(&processor));

        // Create a synthetic 48x48 RGBA PNG image
        let mut img = RgbaImage::from_pixel(48, 48, Rgba([220, 90, 40, 255]));
        for y in 12..36 {
            for x in 12..36 {
                img.put_pixel(x, y, Rgba([30, 140, 240, 255]));
            }
        }
        let raw_png = processor.encode_png(&img, false, false).unwrap();

        // 1. Test Lossless Zopfli PNG + SAM interactive points
        let cmd_png = ProcessImageCommand {
            image_bytes: raw_png.clone(),
            filename: "sample.png".to_string(),
            mode: ProcessingMode::Custom {
                width: 32,
                height: 32,
            },
            upscale: UpscaleConfig::default(),
            beautify: true,
            brightness: 1.05,
            saturation: 1.05,
            sharpness: 1.05,
            sobel_refinement: true,
            remove_background: true,
            bg_model: BackgroundModel::Sam,
            compress: false,
            compression_mode: CompressionMode::LosslessZopfli,
            output_format: OutputFormat::Png,
            jpg_quality: 95,
            jpg_background: [255, 255, 255],
            auto_crop: true,
            sam_include_cardboard: false,
            sam_max_offset_px: 160,
            sam_color_tolerance: 24,
            sam_points: vec![
                InteractivePoint {
                    x: 0.5,
                    y: 0.5,
                    label: 1,
                },
                InteractivePoint {
                    x: 0.1,
                    y: 0.1,
                    label: 0,
                },
            ],
            vectorize: VectorizeConfig::default(),
        };

        let res_png = service.execute(cmd_png).expect("PNG pipeline should succeed");
        assert_eq!(res_png.output_filename, "proc_sample.png");
        assert_eq!(res_png.content_type, "image/png");
        let decoded = processor.decode_image(&res_png.bytes).unwrap();
        assert_eq!(decoded.dimensions(), (32, 32));

        // 2. Test JPG output tolerance
        let mut cmd_jpg = ProcessImageCommand {
            image_bytes: raw_png.clone(),
            filename: "photo.jpg".to_string(),
            mode: ProcessingMode::Original,
            upscale: UpscaleConfig::default(),
            beautify: false,
            brightness: 1.0,
            saturation: 1.0,
            sharpness: 1.0,
            sobel_refinement: false,
            remove_background: true,
            bg_model: BackgroundModel::U2Net,
            compress: false,
            compression_mode: CompressionMode::LosslessMax,
            output_format: OutputFormat::Jpg,
            jpg_quality: 95,
            jpg_background: [255, 255, 255],
            auto_crop: false,
            sam_include_cardboard: true,
            sam_max_offset_px: 160,
            sam_color_tolerance: 24,
            sam_points: vec![],
            vectorize: VectorizeConfig::default(),
        };
        let res_jpg = service.execute(cmd_jpg.clone()).expect("JPG pipeline should succeed");
        assert_eq!(res_jpg.output_filename, "proc_photo.jpg");
        assert_eq!(res_jpg.content_type, "image/jpeg");
        let decoded_jpg = processor.decode_image(&res_jpg.bytes).unwrap();
        assert_eq!(decoded_jpg.dimensions(), (48, 48));

        // 3. Test Adobe Illustrator-style Image Trace (SVG Vectorization)
        cmd_jpg.output_format = OutputFormat::Svg;
        cmd_jpg.vectorize = VectorizeConfig {
            enabled: true,
            preset: TracePreset::IllustrationColor,
            curve_mode: None,
            color_precision: Some(6),
            filter_speckle: Some(2),
            corner_threshold: Some(60),
            length_threshold: Some(4.5),
            splice_threshold: Some(45),
            path_precision: Some(2),
            layer_difference: Some(16),
            hierarchical_cutout: Some(false),
            stroke_enabled: true,
            stroke_width: 1.5,
            stroke_color_auto: true,
            stroke_color: [15, 23, 42],
            fill_enabled: true,
            ignore_color_enabled: true,
            ignore_color_auto: false,
            ignore_color: [255, 255, 255],
            ignore_tolerance: 28,
        };
        let res_svg = service.execute(cmd_jpg.clone()).expect("SVG vectorize pipeline should succeed");
        assert_eq!(res_svg.output_filename, "proc_photo.svg");
        assert_eq!(res_svg.content_type, "image/svg+xml");
        let svg_str = String::from_utf8(res_svg.bytes).unwrap();
        assert!(svg_str.contains("<svg"));
        assert!(svg_str.contains("viewBox="));

        // 4. Test Super-Resolution Scale Up (2x) + Halo-Free Edge De-Blurring
        cmd_jpg.output_format = OutputFormat::Png;
        cmd_jpg.vectorize.enabled = false;
        cmd_jpg.remove_background = false;
        cmd_jpg.upscale = UpscaleConfig {
            enabled: true,
            scale_factor: 2,
            deblur_strength: 0.80,
            denoise_strength: 0.50,
        };
        let res_upscaled = service
            .execute(cmd_jpg)
            .expect("Upscale 2x + deblur pipeline should succeed");
        let decoded_up = processor.decode_image(&res_upscaled.bytes).unwrap();
        assert_eq!(decoded_up.dimensions(), (96, 96));
    }

    #[test]
    fn test_real_onnx_mobile_sam_pipeline() {
        let models_dir = std::path::Path::new("models");
        if !models_dir.join("mobile_sam.encoder.onnx").exists()
            && !models_dir.join("sam_vit_b_01ec64.encoder.onnx").exists()
        {
            return;
        }

        let remover = crate::infrastructure::onnx::ort_background_remover::OrtBackgroundRemover::new(models_dir)
            .expect("OrtBackgroundRemover should initialize");

        let mut img = RgbaImage::from_pixel(256, 256, Rgba([20, 30, 40, 255]));
        // Draw an elongated wide surface [x: 20..236, y: 60..196]
        for y in 60..196 {
            for x in 20..236 {
                img.put_pixel(x, y, Rgba([240, 200, 120, 255]));
            }
        }

        // Click Preserve (+) near the LEFT edge of the surface (x=30/256=0.117, y=128/256=0.5)
        // and Delete (-) on the background (x=0.03, y=0.03).
        let prompts = SamPrompt::from_interactive_points(
            256,
            256,
            &[
                InteractivePoint {
                    x: 30.0 / 256.0,
                    y: 0.5,
                    label: 1,
                },
                InteractivePoint {
                    x: 0.03,
                    y: 0.03,
                    label: 0,
                },
            ],
            true,
            200,
            24,
        );
        let sam_mask = remover
            .predict_mask(&img, BackgroundModel::Sam, Some(&prompts))
            .expect("MobileSAM ONNX inference should succeed");
        assert_eq!(sam_mask.dimensions(), (256, 256));
        assert_eq!(
            sam_mask.get_pixel(225, 128)[0],
            255,
            "Product surface should be solid 255"
        );
        assert_eq!(
            sam_mask.get_pixel(8, 8)[0],
            0,
            "Deleted background surface within max_offset_px should be 0"
        );

        // Simulate Inodorox blister card:
        // - White background (255, 255, 255)
        // - Pale lime-green cardboard [x: 30..226, y: 15..240] -> RGB(228, 238, 195)
        // - Top white cardboard area [x: 75..180, y: 18..90] -> RGB(255, 255, 255)
        // - Dark blue "Inodorox" text inside top white area [x: 90..165, y: 28..48] -> RGB(20, 45, 110)
        // - Dark green "Acción continua" banner [x: 85..170, y: 55..78] -> RGB(35, 115, 45)
        // - Center white window hole [x: 80..175, y: 110..195] -> RGB(255, 255, 255)
        let mut blister = RgbaImage::from_pixel(256, 256, Rgba([255, 255, 255, 255]));
        for y in 15..240 {
            for x in 30..226 {
                blister.put_pixel(x, y, Rgba([228, 238, 195, 255]));
            }
        }
        for y in 18..90 {
            for x in 75..180 {
                blister.put_pixel(x, y, Rgba([255, 255, 255, 255]));
            }
        }
        for y in 28..48 {
            for x in 90..165 {
                blister.put_pixel(x, y, Rgba([20, 45, 110, 255]));
            }
        }
        for y in 55..78 {
            for x in 85..170 {
                blister.put_pixel(x, y, Rgba([35, 115, 45, 255]));
            }
        }
        for y in 110..195 {
            for x in 80..175 {
                blister.put_pixel(x, y, Rgba([255, 255, 255, 255]));
            }
        }

        // User places Red Delete (0) in the center white hole (128, 150) and outer right margin (245, 128),
        // and Green Preserve (1) on the left green border (45, 128) with max_offset_px = 140
        let blister_prompts = SamPrompt::from_interactive_points(
            256,
            256,
            &[
                InteractivePoint {
                    x: 128.0 / 256.0,
                    y: 150.0 / 256.0,
                    label: 0,
                },
                InteractivePoint {
                    x: 245.0 / 256.0,
                    y: 128.0 / 256.0,
                    label: 0,
                },
                InteractivePoint {
                    x: 45.0 / 256.0,
                    y: 128.0 / 256.0,
                    label: 1,
                },
            ],
            true,
            140,
            24,
        );
        let blister_mask = remover
            .predict_mask(&blister, BackgroundModel::Sam, Some(&blister_prompts))
            .expect("Blister mask should succeed");

        // 1. Dark blue "Inodorox" text must be 100% solid (255), NOT hollowed out!
        assert_eq!(blister_mask.get_pixel(120, 38)[0], 255);
        // 2. Dark green "Acción continua" banner must be 100% solid (255), NOT hollowed out!
        assert_eq!(blister_mask.get_pixel(120, 65)[0], 255);
        // 3. Pale lime-green cardboard on the right ("BLOQUE MOCHILA" / "30g") must be 100% solid (255), NOT eaten by white flood-fill!
        assert_eq!(blister_mask.get_pixel(200, 150)[0], 255);
        // 4. Center white hole where Red point was clicked must be 0 (transparent)!
        assert_eq!(blister_mask.get_pixel(128, 150)[0], 0);
        // 5. Outer right white margin where Red point was clicked must be 0 (transparent)!
        assert_eq!(blister_mask.get_pixel(245, 128)[0], 0);
    }
}
