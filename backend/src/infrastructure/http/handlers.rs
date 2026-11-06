use std::path::Path;
use std::sync::Arc;

use actix_files::NamedFile;
use actix_multipart::Multipart;
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use futures_util::TryStreamExt;
use serde::Serialize;
use tracing::error;

use crate::domain::entities::{
    BackgroundModel, CompressionMode, InteractivePoint, OutputFormat, ProcessImageCommand,
    ProcessingMode, TraceCurveMode, TracePreset, UpscaleConfig, VectorizeConfig,
};
use crate::domain::ports::ProcessImageInputPort;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
    models: Vec<&'static str>,
}

#[derive(Serialize)]
struct ErrorResponse {
    detail: String,
}

fn parse_bool(val: &str, default: bool) -> bool {
    match val.trim().to_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => true,
        "false" | "0" | "no" | "off" => false,
        _ => default,
    }
}

fn parse_f32(val: &str, default: f32) -> f32 {
    val.trim().parse::<f32>().unwrap_or(default)
}

fn parse_opt_u32(val: &str) -> Option<u32> {
    val.trim().parse::<u32>().ok()
}

fn parse_opt_i32(val: &str) -> Option<i32> {
    val.trim().parse::<i32>().ok()
}

fn parse_opt_usize(val: &str) -> Option<usize> {
    val.trim().parse::<usize>().ok()
}

fn parse_hex_color(val: &str) -> [u8; 3] {
    let clean = val.trim().trim_start_matches('#');
    if clean.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&clean[0..2], 16),
            u8::from_str_radix(&clean[2..4], 16),
            u8::from_str_radix(&clean[4..6], 16),
        ) {
            return [r, g, b];
        }
    }
    [255, 255, 255]
}

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "running",
        version: "2.0.0",
        models: vec!["u2net", "isnet-general-use", "silueta", "sam"],
    })
}

pub async fn process_image(
    payload: Multipart,
    use_case: web::Data<Arc<dyn ProcessImageInputPort>>,
) -> HttpResponse {
    handle_image_request(payload, use_case, false).await
}

pub async fn vectorize_image(
    payload: Multipart,
    use_case: web::Data<Arc<dyn ProcessImageInputPort>>,
) -> HttpResponse {
    handle_image_request(payload, use_case, true).await
}

async fn handle_image_request(
    mut payload: Multipart,
    use_case: web::Data<Arc<dyn ProcessImageInputPort>>,
    force_vectorize: bool,
) -> HttpResponse {
    let mut file_bytes: Vec<u8> = Vec::new();
    let mut filename = String::from("image.png");
    let mut mode_str = String::from("original");
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;
    let mut upscale_enabled = false;
    let mut upscale_factor: u32 = 2;
    let mut upscale_deblur: f32 = 0.70;
    let mut upscale_denoise: f32 = 0.45;
    let mut beautify = false;
    let mut brightness: f32 = 1.0;
    let mut saturation: f32 = 1.0;
    let mut sharpness: f32 = 1.0;
    let mut sobel_refinement = true;
    let mut remove_background = true;
    let mut bg_model_str = String::from("u2net");
    let mut compress = false;
    let mut compression_mode_str: Option<String> = None;
    let mut output_format_str = if force_vectorize {
        String::from("svg")
    } else {
        String::from("auto")
    };
    let mut jpg_quality: u8 = 95;
    let mut jpg_background: [u8; 3] = [255, 255, 255];
    let mut auto_crop = false;
    let mut sam_include_cardboard = true;
    let mut sam_max_offset_px: u32 = 160;
    let mut sam_color_tolerance: u8 = 24;
    let mut sam_points: Vec<InteractivePoint> = Vec::new();
    let mut vectorize_enabled = force_vectorize;
    let mut trace_preset = TracePreset::IllustrationColor;
    let mut trace_curve_mode: Option<TraceCurveMode> = None;
    let mut trace_color_precision: Option<i32> = None;
    let mut trace_filter_speckle: Option<usize> = None;
    let mut trace_corner_threshold: Option<i32> = None;
    let mut trace_length_threshold: Option<f64> = None;
    let mut trace_splice_threshold: Option<i32> = None;
    let mut trace_path_precision: Option<u32> = None;
    let mut trace_layer_difference: Option<i32> = None;
    let mut trace_cutout: Option<bool> = None;
    let mut trace_stroke_enabled = false;
    let mut trace_stroke_width: f32 = 1.5;
    let mut trace_stroke_color_auto = true;
    let mut trace_stroke_color: [u8; 3] = [15, 23, 42];
    let mut trace_fill_enabled = true;
    let mut trace_ignore_color_enabled = true;
    let mut trace_ignore_color_auto = false;
    let mut trace_ignore_color: [u8; 3] = [255, 255, 255];
    let mut trace_ignore_tolerance: u8 = 28;

    while let Ok(Some(mut field)) = payload.try_next().await {
        let field_name = field
            .content_disposition()
            .and_then(|cd| cd.get_name())
            .unwrap_or("")
            .to_string();

        if field_name == "file" {
            if let Some(fname) = field
                .content_disposition()
                .and_then(|cd| cd.get_filename())
            {
                filename = fname.to_string();
            }

            while let Ok(Some(chunk)) = field.try_next().await {
                file_bytes.extend_from_slice(&chunk);
            }
        } else {
            let mut value_bytes = Vec::new();
            while let Ok(Some(chunk)) = field.try_next().await {
                value_bytes.extend_from_slice(&chunk);
            }
            let val_str = String::from_utf8_lossy(&value_bytes);

            match field_name.as_str() {
                "mode" => mode_str = val_str.trim().to_string(),
                "width" => width = parse_opt_u32(&val_str),
                "height" => height = parse_opt_u32(&val_str),
                "upscale_enabled" | "upscale" => upscale_enabled = parse_bool(&val_str, false),
                "upscale_factor" | "scale_factor" => {
                    upscale_factor = val_str.trim().parse::<u32>().unwrap_or(2).clamp(2, 4);
                }
                "upscale_deblur" | "deblur_strength" => {
                    let raw = parse_f32(&val_str, 0.70);
                    upscale_deblur = if raw > 1.0 { raw / 100.0 } else { raw }.clamp(0.0, 1.0);
                }
                "upscale_denoise" | "denoise_strength" => {
                    let raw = parse_f32(&val_str, 0.45);
                    upscale_denoise = if raw > 1.0 { raw / 100.0 } else { raw }.clamp(0.0, 1.0);
                }
                "beautify" => beautify = parse_bool(&val_str, false),
                "brightness" => brightness = parse_f32(&val_str, 1.0),
                "saturation" => saturation = parse_f32(&val_str, 1.0),
                "sharpness" => sharpness = parse_f32(&val_str, 1.0),
                "sobel_refinement" => sobel_refinement = parse_bool(&val_str, true),
                "remove_background" | "remove_background_first" => {
                    remove_background = parse_bool(&val_str, true)
                }
                "bg_model" => bg_model_str = val_str.trim().to_string(),
                "compress" => compress = parse_bool(&val_str, false),
                "compression_mode" => compression_mode_str = Some(val_str.trim().to_string()),
                "output_format" => output_format_str = val_str.trim().to_string(),
                "jpg_quality" => {
                    jpg_quality = val_str.trim().parse::<u8>().unwrap_or(95).clamp(10, 100);
                }
                "jpg_background" => jpg_background = parse_hex_color(&val_str),
                "auto_crop" => auto_crop = parse_bool(&val_str, false),
                "sam_include_cardboard" => sam_include_cardboard = parse_bool(&val_str, true),
                "sam_max_offset_px" => {
                    sam_max_offset_px = val_str.trim().parse::<u32>().unwrap_or(160).clamp(15, 800);
                }
                "sam_color_tolerance" => {
                    sam_color_tolerance = val_str.trim().parse::<u8>().unwrap_or(24).clamp(4, 120);
                }
                "sam_points" | "sam_prompts" => {
                    if let Ok(parsed) = serde_json::from_str::<Vec<InteractivePoint>>(&val_str) {
                        sam_points = parsed;
                    }
                }
                "vectorize" => vectorize_enabled = parse_bool(&val_str, force_vectorize),
                "trace_preset" | "preset" => trace_preset = TracePreset::from_str(&val_str),
                "trace_curve_mode" | "curve_mode" => {
                    trace_curve_mode = Some(TraceCurveMode::from_str(&val_str))
                }
                "trace_color_precision" | "color_precision" => {
                    trace_color_precision = parse_opt_i32(&val_str)
                }
                "trace_filter_speckle" | "filter_speckle" => {
                    trace_filter_speckle = parse_opt_usize(&val_str)
                }
                "trace_corner_threshold" | "corner_threshold" => {
                    trace_corner_threshold = parse_opt_i32(&val_str)
                }
                "trace_length_threshold" | "length_threshold" => {
                    trace_length_threshold = val_str.trim().parse::<f64>().ok()
                }
                "trace_splice_threshold" | "splice_threshold" => {
                    trace_splice_threshold = parse_opt_i32(&val_str)
                }
                "trace_path_precision" | "path_precision" => {
                    trace_path_precision = parse_opt_u32(&val_str)
                }
                "trace_layer_difference" | "layer_difference" => {
                    trace_layer_difference = parse_opt_i32(&val_str)
                }
                "trace_cutout" => trace_cutout = Some(parse_bool(&val_str, false)),
                "trace_stroke_enabled" => trace_stroke_enabled = parse_bool(&val_str, false),
                "trace_stroke_width" => {
                    trace_stroke_width = parse_f32(&val_str, 1.5).clamp(0.2, 24.0)
                }
                "trace_stroke_color_auto" => {
                    trace_stroke_color_auto = parse_bool(&val_str, true)
                }
                "trace_stroke_color" => {
                    let trimmed = val_str.trim().to_lowercase();
                    if trimmed == "auto" {
                        trace_stroke_color_auto = true;
                    } else {
                        trace_stroke_color = parse_hex_color(&val_str);
                    }
                }
                "trace_fill_enabled" => trace_fill_enabled = parse_bool(&val_str, true),
                "trace_ignore_color_enabled" => {
                    trace_ignore_color_enabled = parse_bool(&val_str, true)
                }
                "trace_ignore_color_auto" => {
                    trace_ignore_color_auto = parse_bool(&val_str, false)
                }
                "trace_ignore_color" => {
                    let trimmed = val_str.trim().to_lowercase();
                    if trimmed == "auto" {
                        trace_ignore_color_auto = true;
                    } else {
                        trace_ignore_color = parse_hex_color(&val_str);
                    }
                }
                "trace_ignore_tolerance" => {
                    trace_ignore_tolerance =
                        val_str.trim().parse::<u8>().unwrap_or(28).clamp(2, 140);
                }
                "hierarchical" => {
                    let h = val_str.trim().to_lowercase();
                    trace_cutout = Some(h == "cutout" || h == "true");
                }
                _ => {}
            }
        }
    }

    if file_bytes.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            detail: "Missing or empty 'file' field in multipart form-data".to_string(),
        });
    }

    let mode = ProcessingMode::from_params(&mode_str, width, height);
    let is_optimized = mode == ProcessingMode::Optimized;
    let compression_mode = CompressionMode::from_params(
        compression_mode_str.as_deref(),
        compress,
        is_optimized,
    );
    let output_format = OutputFormat::from_str(&output_format_str);

    let command = ProcessImageCommand {
        image_bytes: file_bytes,
        filename,
        mode,
        upscale: UpscaleConfig {
            enabled: upscale_enabled,
            scale_factor: upscale_factor,
            deblur_strength: upscale_deblur,
            denoise_strength: upscale_denoise,
        },
        beautify,
        brightness,
        saturation,
        sharpness,
        sobel_refinement,
        remove_background,
        bg_model: BackgroundModel::from_str(&bg_model_str),
        compress,
        compression_mode,
        output_format,
        jpg_quality,
        jpg_background,
        auto_crop,
        sam_include_cardboard,
        sam_max_offset_px,
        sam_color_tolerance,
        sam_points,
        vectorize: VectorizeConfig {
            enabled: vectorize_enabled || output_format == OutputFormat::Svg,
            preset: trace_preset,
            curve_mode: trace_curve_mode,
            color_precision: trace_color_precision,
            filter_speckle: trace_filter_speckle,
            corner_threshold: trace_corner_threshold,
            length_threshold: trace_length_threshold,
            splice_threshold: trace_splice_threshold,
            path_precision: trace_path_precision,
            layer_difference: trace_layer_difference,
            hierarchical_cutout: trace_cutout,
            stroke_enabled: trace_stroke_enabled,
            stroke_width: trace_stroke_width,
            stroke_color_auto: trace_stroke_color_auto,
            stroke_color: trace_stroke_color,
            fill_enabled: trace_fill_enabled,
            ignore_color_enabled: trace_ignore_color_enabled,
            ignore_color_auto: trace_ignore_color_auto,
            ignore_color: trace_ignore_color,
            ignore_tolerance: trace_ignore_tolerance,
        },
    };

    let use_case_clone = Arc::clone(use_case.get_ref());
    let execution_result = web::block(move || use_case_clone.execute(command)).await;

    match execution_result {
        Ok(Ok(processed)) => HttpResponse::Ok()
            .content_type(processed.content_type.as_str())
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"{}\"", processed.output_filename),
            ))
            .insert_header(("X-Original-Size", processed.original_size.to_string()))
            .insert_header(("X-Processed-Size", processed.processed_size.to_string()))
            .insert_header(("X-Output-Format", processed.content_type.clone()))
            .insert_header((
                "Access-Control-Expose-Headers",
                "Content-Disposition, X-Original-Size, X-Processed-Size, X-Output-Format",
            ))
            .body(processed.bytes),
        Ok(Err(domain_err)) => {
            error!("Error processing image: {}", domain_err);
            HttpResponse::InternalServerError().json(ErrorResponse {
                detail: domain_err.to_string(),
            })
        }
        Err(blocking_err) => {
            error!("Task execution error: {}", blocking_err);
            HttpResponse::InternalServerError().json(ErrorResponse {
                detail: format!("Blocking task error: {blocking_err}"),
            })
        }
    }
}

pub async fn serve_index_or_health(req: HttpRequest) -> HttpResponse {
    let index_path = Path::new("static/index.html");
    if index_path.exists() {
        if let Ok(file) = NamedFile::open(index_path) {
            return file.into_response(&req);
        }
    }
    HttpResponse::Ok().json(HealthResponse {
        status: "running",
        version: "2.0.0",
        models: vec!["u2net", "isnet-general-use", "silueta", "sam"],
    })
}

pub async fn serve_spa_fallback(req: HttpRequest, full_path: web::Path<String>) -> HttpResponse {
    let path_str = full_path.into_inner();
    if path_str.starts_with("api")
        || path_str.starts_with("docs")
        || path_str.starts_with("openapi.json")
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            detail: "Not Found".to_string(),
        });
    }

    // Serve root-level static assets (e.g. /favicon.svg) if they exist in static/
    if !path_str.contains("..") {
        let candidate = Path::new("static").join(&path_str);
        if candidate.is_file() {
            if let Ok(file) = NamedFile::open(candidate) {
                return file.into_response(&req);
            }
        }
    }

    let index_path = Path::new("static/index.html");
    if index_path.exists() {
        if let Ok(file) = NamedFile::open(index_path) {
            return file.into_response(&req);
        }
    }

    HttpResponse::NotFound().json(ErrorResponse {
        detail: "Not Found".to_string(),
    })
}
