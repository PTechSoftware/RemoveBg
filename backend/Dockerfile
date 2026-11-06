# Stage 1: Build Rust Backend
FROM rust:1-bookworm AS builder

WORKDIR /usr/src/app

# Copy manifest and source
COPY Cargo.toml ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Stage 2: Final Runtime Image
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Set U2NET directory pointing to the local models directory
ENV U2NET_HOME=/app/models
ENV HOST=0.0.0.0
ENV PORT=8000
ENV RUST_LOG=info

# Copy compiled binary and ONNX models
COPY --from=builder /usr/src/app/target/release/removebg-backend /app/removebg-backend
COPY models /app/models

EXPOSE 8000

CMD ["/app/removebg-backend"]
