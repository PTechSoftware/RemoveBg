# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build

WORKDIR /app-frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build


# Stage 2: Final Image (Python Backend)
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download u2net model (optional but recommended)
RUN python -c "from rembg import remove; import numpy as np; from PIL import Image; remove(Image.new('RGB', (1, 1)))"

# Copy Backend Code
COPY backend/ .

# Copy Frontend Build from Stage 1
COPY --from=frontend-build /app-frontend/dist /app/static

# Expose port
EXPOSE 8000

# Run Application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
