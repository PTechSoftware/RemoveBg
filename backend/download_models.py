import os
import sys

# Desactivar la compilación JIT de numba para evitar que el proceso se quede colgado (muy común en Windows con Python 3.13)
os.environ["NUMBA_DISABLE_JIT"] = "1"

# Definimos el directorio local 'models' dentro de la carpeta 'backend'
models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.environ["U2NET_HOME"] = models_dir

try:
    from rembg import new_session
except ImportError:
    print("Error: El paquete 'rembg' no está instalado. Instalalo ejecutando:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# Lista de todos los modelos que queremos usar
models_to_download = [
    "u2net",
    "isnet-general-use",
    "silueta",
    "sam"
]

def main():
    os.makedirs(models_dir, exist_ok=True)
    print(f"=====================================")
    print(f"Descargando modelos en: {models_dir}")
    print(f"=====================================\n")
    
    for model in models_to_download:
        print(f"Descargando/Verificando {model} ...")
        try:
            # Al instanciar new_session se verifica si el modelo existe, y si no, lo descarga.
            new_session(model)
            print(f"✓ {model} listo.")
        except Exception as e:
            print(f"Error descargando {model}: {e}")
            
    print("\n¡Todos los modelos verificados!")
    print("Estos archivos se van a copiar al Docker container para que el despliegue sea inmediato.")

if __name__ == "__main__":
    main()
