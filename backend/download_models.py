import os
import sys
import urllib.request

# Desactivar la compilación JIT de numba para evitar que el proceso se quede colgado (muy común en Windows con Python 3.13)
os.environ["NUMBA_DISABLE_JIT"] = "1"

# Definimos el directorio local 'models' dentro de la carpeta 'backend'
models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.environ["U2NET_HOME"] = models_dir

try:
    from rembg import new_session
except ImportError:
    print("Error: El paquete 'rembg' no está instalado. Instalalo ejecutando:")
    print("pip install rembg onnxruntime")
    sys.exit(1)

# Lista de modelos rembg rápidos
models_to_download = [
    "u2net",
    "isnet-general-use",
    "silueta",
]

# MobileSAM (TinyViT-5M, 28MB encoder + 16MB decoder: ~7x más rápido que SAM ViT-B y <80MB RAM)
EXTRA_MODELS = [
    (
        "mobile_sam.encoder.onnx",
        "https://huggingface.co/aletrn/sam-quantized/resolve/main/machine_learning_models/mobile_sam.encoder.onnx",
    ),
    (
        "mobile_sam.decoder.onnx",
        "https://huggingface.co/aletrn/sam-quantized/resolve/main/machine_learning_models/mobile_sam.decoder.onnx",
    ),
]


def download_extra_models():
    for filename, url in EXTRA_MODELS:
        target_path = os.path.join(models_dir, filename)
        if os.path.exists(target_path) and os.path.getsize(target_path) > 1024:
            print(f"✓ {filename} ya existe.")
            continue

        print(f"Descargando {filename} (MobileSAM optimizado para CPU)...")
        try:
            urllib.request.urlretrieve(url, target_path)
            print(f"✓ {filename} listo.")
        except Exception as e:
            print(f"Aviso: No se pudo descargar {filename}: {e}")


def main():
    os.makedirs(models_dir, exist_ok=True)
    print("=====================================")
    print(f"Descargando modelos en: {models_dir}")
    print("=====================================\n")

    for model in models_to_download:
        print(f"Descargando/Verificando {model} ...")
        try:
            new_session(model)
            print(f"✓ {model} listo.")
        except Exception as e:
            print(f"Error descargando {model}: {e}")

    download_extra_models()

    print("\n¡Todos los modelos verificados!")
    print("Estos archivos son cargados localmente por el backend en Rust (Actix-Web + ort).")


if __name__ == "__main__":
    main()
