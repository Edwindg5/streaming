from flask import Flask, render_template, send_from_directory, request, redirect, url_for, session, flash
import os
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)  

# Configuración
VIDEO_FOLDER = 'videos'
DATABASE = 'streaming_app.db'
app.config['VIDEO_FOLDER'] = VIDEO_FOLDER

# Asegúrate de que la carpeta de videos existe
os.makedirs(VIDEO_FOLDER, exist_ok=True)

# Funciones para manejo de la base de datos
def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inicializa la base de datos con las tablas necesarias"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Crear tabla de usuarios
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Crear tabla de historial de visualización
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_name TEXT NOT NULL,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        progress FLOAT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    conn.commit()
    conn.close()

# Inicializar la base de datos al iniciar la aplicación
init_db()

# Rutas de autenticación
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            # Iniciar sesión
            session.clear()
            session['user_id'] = user['id']
            session['username'] = user['username']
            flash('Has iniciado sesión correctamente', 'success')
            return redirect(url_for('index'))
        
        flash('Usuario o contraseña incorrectos', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Has cerrado sesión', 'info')
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        email = request.form['email']
        
        # Validaciones básicas
        if not username or not password or not email:
            flash('Todos los campos son obligatorios', 'error')
            return render_template('register.html')
        
        # Hash de la contraseña
        hashed_password = generate_password_hash(password)
        
        conn = get_db_connection()
        try:
            conn.execute(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                (username, hashed_password, email)
            )
            conn.commit()
            flash('Registro exitoso. Ahora puedes iniciar sesión', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('El usuario o email ya existe', 'error')
        finally:
            conn.close()
    
    return render_template('register.html')

# Middleware para verificar si el usuario está logueado
def login_required(view):
    def wrapped_view(**kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return view(**kwargs)
    wrapped_view.__name__ = view.__name__
    return wrapped_view

# Rutas principales
@app.route('/')
@login_required
def index():
    # Obtiene la lista de videos disponibles
    videos = [f for f in os.listdir(app.config['VIDEO_FOLDER']) 
              if f.endswith(('.mp4', '.webm'))]
    
    # Obtener historial de visualización del usuario
    conn = get_db_connection()
    history = conn.execute(
        'SELECT video_name, progress FROM watch_history WHERE user_id = ? ORDER BY watched_at DESC',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    
    # Convertir historial a un diccionario para facilitar acceso
    history_dict = {h['video_name']: h['progress'] for h in history}
    
    return render_template('index.html', videos=videos, history=history_dict, username=session.get('username'))

@app.route('/videos/<filename>')
@login_required
def serve_video(filename):
    """Sirve los videos con soporte para streaming parcial (ranges)"""
    # Registrar visualización en el historial
    user_id = session.get('user_id')
    if user_id:
        conn = get_db_connection()
        # Verificar si ya existe un registro para este video y usuario
        existing = conn.execute(
            'SELECT id FROM watch_history WHERE user_id = ? AND video_name = ?',
            (user_id, filename)
        ).fetchone()
        
        if existing:
            # Actualizar timestamp de visualización
            conn.execute(
                'UPDATE watch_history SET watched_at = CURRENT_TIMESTAMP WHERE id = ?',
                (existing['id'],)
            )
        else:
            # Crear nuevo registro
            conn.execute(
                'INSERT INTO watch_history (user_id, video_name) VALUES (?, ?)',
                (user_id, filename)
            )
        conn.commit()
        conn.close()
    
    return send_from_directory(app.config['VIDEO_FOLDER'], filename)

@app.route('/api/update_progress', methods=['POST'])
@login_required
def update_progress():
    """Actualiza el progreso de visualización de un video"""
    data = request.json
    video_name = data.get('video_name')
    progress = data.get('progress')
    
    if not video_name or progress is None:
        return {'error': 'Datos incompletos'}, 400
    
    conn = get_db_connection()
    # Actualizar o insertar el progreso
    conn.execute(
        '''
        INSERT INTO watch_history (user_id, video_name, progress) 
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, video_name) 
        DO UPDATE SET progress = ?, watched_at = CURRENT_TIMESTAMP
        ''',
        (session['user_id'], video_name, progress, progress)
    )
    conn.commit()
    conn.close()
    
    return {'success': True}

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')