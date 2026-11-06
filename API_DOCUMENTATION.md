# AI Studio · Background Remover & SVG Vectorizer API

## Overview
High-performance Rust (Actix-Web + ONNX Runtime) service using Hexagonal Architecture for:
1. **AI Background Removal**: Supports standard models (`u2net`, `isnet-general-use`, `silueta`), **Depth Anything V2 (`depth`)**, **Interactive SAM (`sam`)**, and the combined **Depth Anything V2 + SAM Pipeline (`depth_sam`)**.
2. **Adobe Illustrator-style Image Trace ("Calco de Imagen")**: Converts raster images (PNG/JPG/WEBP) into clean, scalable **SVG vector graphics** (`vtracer`).
3. **Advanced Lossless Compression**: Supports multi-tier **100% Lossless PNG optimization** (`oxipng` + Clean Transparent Pixels + Google **Zopfli** Deflate) as well as smart 8-bit quantization (`libimagequant`).
4. **JPG, PNG & SVG Tolerance**: Accepts and exports `.png`, `.jpg`/`.jpeg`, and `.svg`.

---

## Endpoints

### 1. Health Check
**GET** `/api/health`

```json
{
  "status": "running",
  "version": "2.0.0",
  "models": ["u2net", "isnet-general-use", "silueta", "depth", "sam", "depth_sam"]
}
```

---

### 2. Process or Vectorize Image
**POST** `/process-image` (or `/vectorize-image`)

Multipart form-data parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | **Required** | Input image (`.png`, `.jpg`, `.jpeg`, `.webp`) |
| `bg_model` | String | `u2net` | `depth_sam` (Depth Anything V2 + SAM pipeline), `sam`, `depth`, `u2net`, `isnet-general-use`, `silueta` |
| `sam_points` | JSON | `[]` | Array of interactive points: `[{"x": 0.5, "y": 0.5, "label": 1}, {"x": 0.1, "y": 0.1, "label": 0}]` (`1` = Preserve, `0` = Delete) |
| `output_format` | String | `auto` | `auto`, `png`, `jpg`, or `svg` |
| `compression_mode` | String | `lossless_balanced` | `lossless_balanced`, `lossless_max`, `lossless_zopfli`, `lossless_fast`, `png8_quant`, or `none` |
| `jpg_quality` | Integer | `95` | JPEG quality (`10..=100`) when exporting as `jpg` |
| `jpg_background` | String | `#ffffff` | Hex color for transparent areas when exporting as `jpg` |
| `vectorize` | Boolean | `false` | Enables Adobe Illustrator-style Image Trace to output `.svg` |
| `trace_preset` | String | `illustration` | `illustration`, `high_fidelity`, `poster`, `bw`, `line_art` |
| `trace_color_precision` | Integer | `6` | Significant color bits (`1..=8`) for SVG vectorization |
| `trace_filter_speckle` | Integer | `4` | Noise speckle filter size (`0..=64` px) |
| `trace_corner_threshold` | Integer | `60` | Corner smoothness threshold in degrees (`0..=180`) |
| `mode` | String | `original` | `original`, `optimized` (~500px), or `custom` (`width` x `height`) |
| `beautify` | Boolean | `false` | Catalog enhancement (+20% saturation, +15% contrast, +50% sharpness) |
| `sobel_refinement` | Boolean | `true` | Bilateral edge contour refinement |
| `auto_crop` | Boolean | `false` | Trims transparent borders and centers into a square canvas |
