pub mod application;
pub mod domain;
pub mod infrastructure;

use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use tracing::info;

use crate::application::process_image_use_case::ProcessImageService;
use crate::domain::entities::BackgroundModel;
use crate::domain::ports::{
    BackgroundRemoverOutputPort, ImageProcessorOutputPort, ProcessImageInputPort,
};
use crate::infrastructure::http::routes::configure_routes;
use crate::infrastructure::image_processing::native_image_processor::NativeImageProcessor;
use crate::infrastructure::onnx::ort_background_remover::OrtBackgroundRemover;

fn resolve_models_dir() -> PathBuf {
    if let Ok(u2net_home) = env::var("U2NET_HOME") {
        return PathBuf::from(u2net_home);
    }
    PathBuf::from("models")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let models_dir = resolve_models_dir();
    info!("Using ONNX models directory: {:?}", models_dir);

    // 1. Instantiate Driven Adapters (Infrastructure -> Outbound Ports)
    let bg_remover: Arc<dyn BackgroundRemoverOutputPort> =
        Arc::new(OrtBackgroundRemover::new(&models_dir).expect("Failed to initialize ONNX adapter"));
    let image_processor: Arc<dyn ImageProcessorOutputPort> =
        Arc::new(NativeImageProcessor::new());

    // Preload models in the background to avoid blocking API startup
    {
        let bg_remover_preload = Arc::clone(&bg_remover);
        std::thread::spawn(move || {
            bg_remover_preload.preload_models(&[
                BackgroundModel::U2Net,
                BackgroundModel::Sam,
            ]);
        });
    }

    // 2. Instantiate Application Use Case (Application -> Inbound Port)
    let process_image_use_case: Arc<dyn ProcessImageInputPort> =
        Arc::new(ProcessImageService::new(bg_remover, image_processor));

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8000);

    info!("Starting Background Remover & Vectorizer API (Actix-Web) on http://{host}:{port}");

    // 3. Start Driving Adapter (Actix-Web HTTP Server)
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(web::PayloadConfig::new(50 * 1024 * 1024)) // 50 MB max upload
            .app_data(web::Data::new(Arc::clone(&process_image_use_case)))
            .configure(configure_routes)
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
