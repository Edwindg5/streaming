// main.js
document.addEventListener('DOMContentLoaded', function() {
    const videoPlayer = document.getElementById('video-player');
    const videoCards = document.querySelectorAll('.video-card');
    const connectionStatus = document.getElementById('connection-status');
    const statusText = connectionStatus.querySelector('.status-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const currentVideoTitle = document.getElementById('current-video-title');
    
    // Cache para videos precargados
    const videoCache = new Map();
    
    // Variables para el seguimiento de progreso
    let currentVideoUrl = '';
    let currentVideoName = '';
    let isUpdatingProgress = false;
    
    // Ocultar mensajes flash después de 5 segundos
    const messages = document.querySelectorAll('.message');
    messages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });
    
    // Verificar conexión a internet
    function updateOnlineStatus() {
        if (navigator.onLine) {
            connectionStatus.className = 'connection-status online';
            statusText.textContent = 'En línea';
        } else {
            connectionStatus.className = 'connection-status offline';
            statusText.textContent = 'Fuera de línea (reproduciendo desde caché)';
        }
    }
    
    // Eventos para detectar cambios en la conexión
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Inicializar estado
    updateOnlineStatus();
    
    // Mostrar loading
    function showLoading() {
        loadingOverlay.classList.add('active');
    }
    
    // Ocultar loading
    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }
    
    // Función para precargar un video
    async function preloadVideo(url) {
        if (videoCache.has(url)) {
            console.log('Video ya en caché:', url);
            return videoCache.get(url);
        }
        
        try {
            console.log('Precargando video:', url);
            showLoading();
            
            const response = await fetch(url);
            
            // Verificar si la respuesta fue exitosa
            if (!response.ok) {
                throw new Error(`Error al cargar el video: ${response.status}`);
            }
            
            // Obtener el blob del video
            const blob = await response.blob();
            
            // Crear URL para el blob
            const videoObjectUrl = URL.createObjectURL(blob);
            
            // Guardar en caché
            videoCache.set(url, {
                objectUrl: videoObjectUrl,
                blob: blob
            });
            
            console.log('Video precargado y en caché:', url);
            hideLoading();
            return videoCache.get(url);
        } catch (error) {
            console.error('Error precargando video:', error);
            hideLoading();
            showNotification('Error al cargar el video', 'error');
            return null;
        }
    }
    
    // Función para mostrar notificaciones
    function showNotification(message, type = 'info') {
        const messageContainer = document.querySelector('.message-container');
        
        const notification = document.createElement('div');
        notification.className = `message ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        
        notification.innerHTML = `<i class="fas fa-${icon}"></i>${message}`;
        
        messageContainer.appendChild(notification);
        
        // Eliminar después de 5 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
    
    // Función para reproducir un video desde la URL o la caché
    async function playVideo(url, videoName) {
        currentVideoUrl = url;
        currentVideoName = videoName;
        currentVideoTitle.textContent = videoName;
        
        // Scroll hasta el reproductor
        document.getElementById('player-section').scrollIntoView({ behavior: 'smooth' });
        
        showLoading();
        
        if (navigator.onLine) {
            // Si estamos en línea, precargar el video
            const cachedVideo = await preloadVideo(url);
            
            if (cachedVideo) {
                // Usar la versión en caché
                videoPlayer.src = cachedVideo.objectUrl;
            } else {
                // Usar la URL directamente
                videoPlayer.src = url;
            }
        } else {
            // Si estamos fuera de línea, intentar reproducir desde caché
            if (videoCache.has(url)) {
                videoPlayer.src = videoCache.get(url).objectUrl;
            } else {
                hideLoading();
                showNotification('Video no disponible sin conexión', 'error');
                return;
            }
        }
        
        // Buscar el progreso guardado para este video
        const progressElement = document.querySelector(`.video-card[data-name="${videoName}"] .progress`);
        if (progressElement) {
            const progressWidth = progressElement.style.width;
            if (progressWidth) {
                const progress = parseFloat(progressWidth) / 100;
                if (progress > 0 && progress < 0.95) {  // No saltamos si está casi al final
                    videoPlayer.addEventListener('loadedmetadata', function onLoaded() {
                        const seekTime = progress * videoPlayer.duration;
                        videoPlayer.currentTime = seekTime;
                        videoPlayer.removeEventListener('loadedmetadata', onLoaded);
                        hideLoading();
                    });
                } else {
                    hideLoading();
                }
            } else {
                hideLoading();
            }
        } else {
            hideLoading();
        }
        
        // Iniciar reproducción
        videoPlayer.play().catch(e => {
            console.error('Error reproduciendo video:', e);
            hideLoading();
        });
    }
    
    // Actualizar progreso de visualización
    async function updateProgress() {
        if (!currentVideoName || !videoPlayer.duration || isUpdatingProgress) return;
        
        const progress = videoPlayer.currentTime / videoPlayer.duration;
        if (isNaN(progress)) return;
        
        // Actualizar barra de progreso en la UI
        const progressElement = document.querySelector(`.video-card[data-name="${currentVideoName}"] .progress`);
        if (progressElement) {
            progressElement.style.width = `${progress * 100}%`;
        }
        
        // Si estamos en línea, enviar progreso al servidor
        if (navigator.onLine && progress > 0) {
            try {
                isUpdatingProgress = true;
                const response = await fetch('/api/update_progress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        video_name: currentVideoName,
                        progress: progress
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Error al actualizar progreso: ${response.status}`);
                }
            } catch (error) {
                console.error('Error guardando progreso:', error);
            } finally {
                isUpdatingProgress = false;
            }
        }
    }
    
    // Actualizar progreso periódicamente
    setInterval(updateProgress, 5000);  // Cada 5 segundos
    
    // También actualizar al pausar el video
    videoPlayer.addEventListener('pause', updateProgress);
    
    // Y al terminar el video
    videoPlayer.addEventListener('ended', function() {
        // Marcar como 100% completado
        const progressElement = document.querySelector(`.video-card[data-name="${currentVideoName}"] .progress`);
        if (progressElement) {
            progressElement.style.width = '100%';
        }
        updateProgress();
        showNotification('Reproducción completada', 'success');
    });
    
    // Eventos de carga del video
    videoPlayer.addEventListener('waiting', showLoading);
    videoPlayer.addEventListener('playing', hideLoading);
    
    // Agregar eventos de clic a cada tarjeta de video
    videoCards.forEach(card => {
        const videoUrl = card.getAttribute('data-src');
        const videoName = card.getAttribute('data-name');
        
        card.addEventListener('click', function() {
            playVideo(videoUrl, videoName);
        });
    });
    
    // Precargar los videos solo cuando se necesiten
    // No precargamos todos al inicio para ahorrar ancho de banda
    
    // Si el video actual se detiene porque se terminó el buffer pero estamos fuera de línea,
    // intentar reanudar desde donde quedó usando la caché
    videoPlayer.addEventListener('stalled', function() {
        if (!navigator.onLine && currentVideoUrl && videoCache.has(currentVideoUrl)) {
            console.log('Video detenido, intentando reanudar desde caché');
            showLoading();
            const currentTime = videoPlayer.currentTime;
            videoPlayer.src = videoCache.get(currentVideoUrl).objectUrl;
            videoPlayer.currentTime = currentTime;
            videoPlayer.play().catch(e => {
                console.error('Error reanudando video:', e);
                hideLoading();
            });
        }
    });
});