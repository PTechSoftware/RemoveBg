import os

# Configurar directorio local de los modelos ONNX (antes de importar rembg)
if "U2NET_HOME" not in os.environ:
    os.environ["U2NET_HOME"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove, new_session
from PIL import Image
import io
import uvicorn
from contextlib import asynccontextmanager
import concurrent.futures
from image_utils import ImageAgent

model_sessions = {}

def get_model_session(model_name: str):
    # Map SAM3 requests to the rembg SAM session which handles ONNX internally
    if model_name.lower() in ["sam3", "mobile_sam"]:
        model_name = "sam"
        
    if model_name not in model_sessions:
        print(f"Loading rembg model: {model_name}...")
        # Al forzar el CPUExecutionProvider explícitamente evitamos que onnxruntime  
        # demore buscando drivers de GPU (CUDA/TensorRT) que no existen o están mal configurados
        model_sessions[model_name] = new_session(model_name, providers=["CPUExecutionProvider"])
        print(f"Model {model_name} loaded successfully!")
    return model_sessions[model_name]

def preload_models():
    models_to_preload = ["u2net", "sam"]
    for m in models_to_preload:
        get_model_session(m)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload models in the background to avoid blocking the API startup
    with concurrent.futures.ThreadPoolExecutor() as pool:
        pool.submit(preload_models)
    yield
    model_sessions.clear()

app = FastAPI(
    title="Background Remover API",    
    lifespan=lifespan,
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
    "/api/health",
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
    height: int = Form(None, description="Target height in pixels (only for custom mode)"),
    beautify: bool = Form(False, description="Apply beautification for catalog quality"),
    brightness: float = Form(1.0, description="Brightness multiplier"),
    saturation: float = Form(1.0, description="Saturation multiplier"),
    sharpness: float = Form(1.0, description="Sharpness multiplier"),
    sobel_refinement: bool = Form(True, description="Use Sobel filtering to reinforce contours"),
    remove_background: bool = Form(True, description="Whether to remove the background"),
    bg_model: str = Form("u2net", description="Model for background removal"),
    compress: bool = Form(False, description="Compress PNG output (PNG-8)"),
    auto_crop: bool = Form(False, description="Remove transparent borders"),
    sam_include_cardboard: bool = Form(True, description="Include packaging/cardboard when using SAM")
):
    """
    Remove background from an uploaded image using AI.
    
    **Features:**
    - `sobel_reinforcement`: Uses Sobel filtering to refine the edges of the background removal.
    - `beautify`: Enchances colors, contrast and sharpness for a premium catalog look.
    
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
        
        # Ensure we are in a mode that supports processing
        if input_image.mode not in ("RGB", "RGBA"):
            input_image = input_image.convert("RGBA")

        # 0. Apply manual adjustments (Brightness, Saturation, Sharpness)
        if brightness != 1.0 or saturation != 1.0 or sharpness != 1.0:
            input_image = ImageAgent.adjust_image(input_image, brightness, saturation, sharpness)

        # 1. Beautification Agent (Optional)
        if beautify:
            input_image = ImageAgent.beautify(input_image)

        # 2. Background Removal & Reinforcement
        if remove_background:
            # Remove background using rembg
            session = get_model_session(bg_model)
            
            rembg_kwargs = {}
            if bg_model.lower() in ["sam", "sam3", "mobile_sam"]:
                width, height = input_image.size
                if sam_include_cardboard:
                    # Capturar el objeto principal mas el carton (margen y punto central)
                    margin_x = int(width * 0.05)
                    margin_y = int(height * 0.05)
                    rembg_kwargs["sam_prompt"] = [
                        {
                            "type": "rectangle",
                            "data": [margin_x, margin_y, width - margin_x, height - margin_y]
                        },
                        {
                            "type": "point",
                            "label": 1,
                            "data": [int(width / 2), int(height / 2)]
                        }
                    ]
                else:
                    # Capturar unicamente el objeto en el centro (sin carton)
                    rembg_kwargs["sam_prompt"] = [
                        {
                            "type": "point",
                            "label": 1,
                            "data": [int(width / 2), int(height / 2)]
                        }
                    ]
                
            output_image = remove(input_image, session=session, alpha_matting=sobel_refinement, **rembg_kwargs)

            # 3. Sobel Edge Reinforcement
            if sobel_refinement:
                output_image = ImageAgent.refine_mask_with_sobel(input_image, output_image)
        else:
            # If we don't remove background, the output is just the (optionally beautified) input
            output_image = input_image

        # 4. Auto Crop (Optional)
        if auto_crop:
            output_image = ImageAgent.auto_crop(output_image)

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
        
        # 6. Compression (Optional)
        if compress:
            output_image = ImageAgent.compress_png(output_image)

        # Return as PNG with optimization for smaller file size
        img_byte_arr = io.BytesIO()
        if mode == "optimized" or compress:
            # Optimize PNG for smaller file size
            output_image.save(img_byte_arr, format='PNG', optimize=True)
        else:
            output_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            img_byte_arr, 
            media_type="image/png",
            headers={"Content-Disposition": f"attachment; filename=proc_{file.filename}"}
        )

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files (Frontend)
# We check if static directory exists (it will in the docker container)
if os.path.isdir("static"):
    # Mount assets folder (handled by Vite build)
    if os.path.isdir("static/assets"):
        app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    
    @app.get("/")
    async def serve_index():
        return FileResponse("static/index.html")

    # Catch-all route for SPA (React Router)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes to pass through (though they are matched first usually)
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
             raise HTTPException(status_code=404, detail="Not Found")
        
        # Serve index.html
        return FileResponse("static/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
