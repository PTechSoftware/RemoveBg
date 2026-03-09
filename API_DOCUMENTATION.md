# Background Remover API - Documentation

## Overview
AI-powered background removal service using the U2NET deep learning model. Supports batch processing with multiple output modes.

---

## Base URL
```
http://localhost:8000
```

---

## Endpoints

### 1. Health Check
**GET** `/`

Check if the API is running.

**Response:**
```json
{
  "status": "running",
  "version": "1.0.0"
}
```

---

### 2. Process Image
**POST** `/process-image`

Remove background from an uploaded image.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | Image file (PNG, JPG, WEBP) |
| `mode` | String | No | Processing mode: `original`, `optimized`, or `custom` (default: `original`) |
| `width` | Integer | No | Target width in pixels (only for `custom` mode) |
| `height` | Integer | No | Target height in pixels (only for `custom` mode) |
| `beautify` | Boolean | No | Enhance colors and contrast for catalog look (default: `false`) |
| `sobel_refinement` | Boolean | No | Use Sobel filter to improve contour detection (default: `true`) |
| `remove_background` | Boolean | No | Whether to remove the background (default: `true`) |
| `compress` | Boolean | No | Compress output to 8-bit PNG (PNG-8) (default: `false`) |
| `auto_crop` | Boolean | No | Trim transparency and pad to square (default: `false`) |

**Modes:**
- **original**: Preserves original image dimensions
- **optimized**: Resizes to ~500px on longest side, maintains aspect ratio, reduces file size
- **custom**: Resizes to exact width × height

**Response:**
- Content-Type: `image/png`
- PNG image with transparent background

---

## Usage Examples

### cURL

**Original Size:**
```bash
curl -X POST "http://localhost:8000/process-image" \
  -F "file=@image.jpg" \
  -F "mode=original" \
  --output result.png
```

**Optimized (500px):**
```bash
curl -X POST "http://localhost:8000/process-image" \
  -F "file=@image.jpg" \
  -F "mode=optimized" \
  --output result.png
```

**Custom Size:**
```bash
curl -X POST "http://localhost:8000/process-image" \
  -F "file=@image.jpg" \
  -F "mode=custom" \
  -F "width=800" \
  -F "height=600" \
  --output result.png
```

### Python

```python
import requests

# Upload and process image
with open('image.jpg', 'rb') as f:
    files = {'file': f}
    data = {'mode': 'optimized'}
    
    response = requests.post(
        'http://localhost:8000/process-image',
        files=files,
        data=data
    )
    
    # Save result
    with open('result.png', 'wb') as out:
        out.write(response.content)
```

### JavaScript (Fetch)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('mode', 'optimized');

const response = await fetch(`http://${window.location.hostname}:8000/process-image`, {
  method: 'POST',
  body: formData
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
// Use url for download or preview
```

---

## Interactive Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

These interfaces allow you to:
- View all endpoints and their parameters
- Test API calls directly in the browser
- See request/response schemas
- Download OpenAPI specification

---

## Error Handling

**500 Internal Server Error**
```json
{
  "detail": "Error message describing what went wrong"
}
```

Common errors:
- Invalid image format
- Corrupted image file
- Missing required parameters (width/height in custom mode)

---

## Technical Details

**Model:** U2NET (Universal U-Net)
**Backend:** FastAPI + rembg + ONNX Runtime
**Processing:** CPU-based inference
**Output Format:** PNG with alpha channel (transparency)

---

## Rate Limits
No rate limits currently implemented. For production use, consider implementing rate limiting.

---

## CORS
Currently configured to allow all origins (`*`). Modify in production to restrict to specific domains.
