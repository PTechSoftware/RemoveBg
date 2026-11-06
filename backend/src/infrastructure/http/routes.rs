use std::path::Path;

use actix_files::Files;
use actix_web::web;

use crate::infrastructure::http::handlers;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/health", web::get().to(handlers::health_check))
        .route("/process-image", web::post().to(handlers::process_image))
        .route("/vectorize-image", web::post().to(handlers::process_image));

    if Path::new("static").is_dir() {
        if Path::new("static/assets").is_dir() {
            cfg.service(Files::new("/assets", "static/assets"));
        }
        cfg.route("/", web::get().to(handlers::serve_index_or_health))
            .route(
                "/{full_path:.*}",
                web::get().to(handlers::serve_spa_fallback),
            );
    } else {
        cfg.route("/", web::get().to(handlers::serve_index_or_health));
    }
}
