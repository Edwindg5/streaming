# Guía Rápida de Instalación - VideoFlix

Esta guía te ayudará a instalar y configurar rápidamente la aplicación VideoFlix en tu sistema.

## Paso 1: Instalar Python

### Windows:
1. Descarga Python desde [python.org](https://www.python.org/downloads/windows/)
2. Durante la instalación, **marca la casilla "Add Python to PATH"**
3. Verifica la instalación abriendo CMD y escribiendo: `python --version`

### macOS:
```
brew install python
```

### Linux:
```
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

## Paso 2: Preparar el proyecto

1. Crea una carpeta para el proyecto:
```
mkdir videoflix
cd videoflix
```

2. Crea estas subcarpetas:
```
mkdir templates
mkdir videos
```

3. Crea el entorno virtual y actívalo:

**Windows:**
```
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```
python3 -m venv venv
source venv/bin/activate
```

## Paso 3: Instalar dependencias

1. Crea un archivo `requirements.txt` con este contenido:
```
Flask==2.2.3
Werkzeug==2.2.3
```

2. Instala las dependencias:
```
pip install -r requirements.txt
```

## Paso 4: Crear los archivos de la aplicación

1. Copia el código del archivo `app.py` proporcionado anteriormente
2. Copia las plantillas HTML en la carpeta `templates`:
   - `index.html` (página principal rediseñada)
   - `login.html` (página de inicio de sesión)
   - `register.html` (página de registro)

## Paso 5: Añadir videos de muestra

1. Coloca algunos archivos de video (.mp4 o .webm) en la carpeta `videos`

## Paso 6: Ejecutar la aplicación

1. Con el entorno virtual activado, ejecuta:
```
python app.py
```

2. Abre tu navegador y ve a:
```
http://localhost:5000
```

3. Regístrate para crear una cuenta y comenzar a usar la aplicación

## Verificar que todo funciona

- Deberías poder registrarte y luego iniciar sesión
- Tus videos deberían aparecer en la página principal
- Al hacer clic en un video, debería comenzar a reproducirse
- Prueba a desconectar tu internet (desactiva WiFi) mientras ves un video para comprobar que sigue funcionando

## Solución de problemas comunes

- **Error "no module named flask"**: Asegúrate de que el entorno virtual está activado y que has instalado las dependencias
- **No puedo activar el entorno virtual**: En Windows PowerShell ejecuta primero `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process`
- **La app no muestra videos**: Verifica que tienes archivos de video en la carpeta `videos`
- **Error al registrarme**: Asegúrate de que la aplicación tiene permisos para crear la base de datos SQLite