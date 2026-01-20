from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
from PIL import Image
import io
import uvicorn

app = FastAPI(
    title="Background Remover API",
    description="""
    ## AI-Powered Background Removal Service
    
    This API provides automated background removal using the U2NET deep learning model.
    
    ### Features
    * **Original Mode**: Preserves original image dimensions
    * **Optimized Mode**: Resizes to ~500px (maintains aspect ratio, reduces file size)
    * **Custom Mode**: Specify exact width and height
    
    ### Supported Formats
    * Input: PNG, JPG, JPEG, WEBP
    * Output: PNG with transparency
    
    ### Processing
    All images are processed using the rembg library with U2NET model for high-quality background removal.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get(
    "/",
    summary="Health check",
    description="Check if the API is running",
    tags=["System"]
)
async def health_check():
    """
    Simple health check endpoint.
    
    Returns a JSON object indicating the API status.
    """
    return {"status": "running", "version": "1.0.0"}

@app.post(
    "/process-image",
    summary="Remove background from image",
    description="Upload an image and receive a PNG with transparent background",
    response_description="PNG image with removed background",
    tags=["Image Processing"]
)
async def process_image(
    file: UploadFile = File(..., description="Image file to process (PNG, JPG, WEBP)"),
    mode: str = Form("original", description="Processing mode: 'original', 'optimized', or 'custom'"),
    width: int = Form(None, description="Target width in pixels (only for custom mode)"),
    height: int = Form(None, description="Target height in pixels (only for custom mode)")
):
    """
    Remove background from an uploaded image using AI.
    
    **Modes:**
    - `original`: Keep original dimensions
    - `optimized`: Resize to ~500px max dimension (maintains aspect ratio)
    - `custom`: Resize to specific width x height
    
    **Example using curl:**
    ```bash
    # Original size
    curl -X POST "http://localhost:8000/process-image" \\
      -F "file=@image.jpg" \\
      -F "mode=original" \\
      --output result.png
    
    # Optimized (500px)
    curl -X POST "http://localhost:8000/process-image" \\
      -F "file=@image.jpg" \\
      -F "mode=optimized" \\
      --output result.png
    
    # Custom size
    curl -X POST "http://localhost:8000/process-image" \\
      -F "file=@image.jpg" \\
      -F "mode=custom" \\
      -F "width=800" \\
      -F "height=600" \\
      --output result.png
    ```
    
    **Returns:** PNG image file with transparent background
    """
    try:
        # Read image
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents))

        # Remove background using rembg
        output_image = remove(input_image)

        # Handle Resizing
        if mode == "custom" and width is not None and height is not None:
            # Custom dimensions
            output_image = output_image.resize((width, height), Image.Resampling.LANCZOS)
        elif mode == "optimized":
            # Resize to ~500px on longest side, maintaining aspect ratio
            original_width, original_height = output_image.size
            max_dimension = 500
            
            if original_width > original_height:
                new_width = max_dimension
                new_height = int((max_dimension / original_width) * original_height)
            else:
                new_height = max_dimension
                new_width = int((max_dimension / original_height) * original_width)
            
            output_image = output_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Return as PNG with optimization for smaller file size
        img_byte_arr = io.BytesIO()
        if mode == "optimized":
            # Optimize PNG for smaller file size
            output_image.save(img_byte_arr, format='PNG', optimize=True)
        else:
            output_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            img_byte_arr, 
            media_type="image/png",
            headers={"Content-Disposition": f"attachment; filename=removed_{file.filename}"}
        )

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
