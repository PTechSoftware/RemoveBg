use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Invalid image format or corrupted file: {0}")]
    InvalidImage(String),

    #[error("Invalid processing parameters: {0}")]
    InvalidParameters(String),

    #[error("Model error ({model}): {message}")]
    ModelError { model: String, message: String },

    #[error("Image processing error: {0}")]
    ImageProcessingError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}
