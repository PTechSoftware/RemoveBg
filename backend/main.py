from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
from PIL import Image
import io
import uvicorn

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "running"}

@app.post("/process-image")
async def process_image(
    file: UploadFile = File(...),
    mode: str = Form("original"), # "original", "custom", or "optimized"
    width: int = Form(None),
    height: int = Form(None)
):
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
