// main.js con correcciones para NetoFlix
document.addEventListener('DOMContentLoaded', function() {
    const videoPlayer = document.getElementById('video-player');
    const videoCards = document.querySelectorAll('.group[data-src][data-name]');
    const connectionStatus = document.getElementById('connection-status');
    const statusText = connectionStatus ? connectionStatus.querySelector('span:not(.inline-block)') : null;
    const loadingOverlay = document.getElementById('loading-overlay');
    const currentVideoTitle = document.getElementById('current-video-title');
    
    // Cache para videos precargados (en memoria)
    const videoCache = new Map();
    
    // Variables para el seguimiento de progreso
    let currentVideoUrl = '';
    let currentVideoName = '';
    let isUpdatingProgress = false;
    
    // Variables para controlar reintentos de sincronización del progreso
    let progressSyncErrors = 0;
    let progressSyncDisabled = false;
    const MAX_SYNC_ERRORS = 3;
    
    // Inicializar IndexedDB para almacenamiento persistente
    let db;
    const dbName = 'NetoFlixVideoDB';
    const videoStoreName = 'videos';
    
    // Inicializar IndexedDB
    function initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.error("Su navegador no soporta IndexedDB");
                return reject("IndexedDB no soportado");
            }
            
            const request = indexedDB.open(dbName, 1);
            
            request.onerror = event => {
                console.error('Error al abrir IndexedDB:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = event => {
                db = event.target.result;
                console.log('IndexedDB abierta correctamente');
                resolve(db);
            };
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(videoStoreName)) {
                    const store = db.createObjectStore(videoStoreName, { keyPath: 'videoUrl' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Store de videos creado');
                }
            };
        });
    }
    
    // Guardar video en IndexedDB
    function saveVideoToIndexedDB(videoUrl, blob, videoName) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('IndexedDB no está inicializada'));
                return;
            }
            
            const transaction = db.transaction([videoStoreName], 'readwrite');
            const store = transaction.objectStore(videoStoreName);
            
            const videoData = {
                videoUrl: videoUrl,
                videoName: videoName,
                blob: blob,
                timestamp: new Date().getTime()
            };
            
            const request = store.put(videoData);
            
            request.onsuccess = () => {
                console.log('Video guardado en IndexedDB:', videoUrl);
                resolve();
            };
            
            request.onerror = event => {
                console.error('Error al guardar video en IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Obtener video desde IndexedDB
    function getVideoFromIndexedDB(videoUrl) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('IndexedDB no está inicializada'));
                return;
            }
            
            const transaction = db.transaction([videoStoreName], 'readonly');
            const store = transaction.objectStore(videoStoreName);
            const request = store.get(videoUrl);
            
            request.onsuccess = event => {
                const result = event.target.result;
                if (result) {
                    console.log('Video recuperado de IndexedDB:', videoUrl);
                    resolve(result);
                } else {
                    console.log('Video no encontrado en IndexedDB:', videoUrl);
                    resolve(null);
                }
            };
            
            request.onerror = event => {
                console.error('Error al recuperar video de IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Limpiar videos antiguos si supera cierto límite
    async function cleanupOldVideos() {
        try {
            const maxVideos = 5; // Máximo número de videos a mantener
            
            if (!db) return;
            
            const transaction = db.transaction([videoStoreName], 'readonly');
            const store = transaction.objectStore(videoStoreName);
            const index = store.index('timestamp');
            const request = index.openCursor();
            
            const videos = [];
            
            return new Promise((resolve, reject) => {
                request.onsuccess = e => {
                    const cursor = e.target.result;
                    if (cursor) {
                        videos.push({
                            videoUrl: cursor.value.videoUrl,
                            timestamp: cursor.value.timestamp
                        });
                        cursor.continue();
                    } else {
                        // Si hay más videos de los permitidos, eliminar los más antiguos
                        if (videos.length > maxVideos) {
                            // Ordenar por timestamp (más antiguos primero)
                            videos.sort((a, b) => a.timestamp - b.timestamp);
                            
                            // Eliminar los videos más antiguos
                            const videosToDelete = videos.slice(0, videos.length - maxVideos);
                            
                            const deleteTransaction = db.transaction([videoStoreName], 'readwrite');
                            const deleteStore = deleteTransaction.objectStore(videoStoreName);
                            
                            videosToDelete.forEach(video => {
                                deleteStore.delete(video.videoUrl);
                                console.log('Video antiguo eliminado:', video.videoUrl);
                            });
                            
                            deleteTransaction.oncomplete = () => {
                                console.log(`${videosToDelete.length} videos antiguos eliminados`);
                                resolve();
                            };
                        } else {
                            resolve();
                        }
                    }
                };
                
                request.onerror = e => {
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error('Error al limpiar videos antiguos:', error);
        }
    }
    
    // Verificar conexión a internet
    function updateOnlineStatus() {
        if (!connectionStatus || !statusText) return;
        
        if (navigator.onLine) {
            connectionStatus.classList.remove('bg-error/20');
            connectionStatus.classList.add('bg-dark/70');
            statusText.textContent = 'Conectado - Ultra HD';
            
            const statusIndicator = connectionStatus.querySelector('.inline-block');
            if (statusIndicator) {
                statusIndicator.classList.remove('bg-error');
                statusIndicator.classList.add('bg-success');
            }
        } else {
            connectionStatus.classList.add('bg-error/20');
            connectionStatus.classList.remove('bg-dark/70');
            statusText.textContent = 'Fuera de línea (reproduciendo desde caché)';
            
            const statusIndicator = connectionStatus.querySelector('.inline-block');
            if (statusIndicator) {
                statusIndicator.classList.add('bg-error');
                statusIndicator.classList.remove('bg-success');
            }
        }
    }
    
    // Eventos para detectar cambios en la conexión
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Inicializar estado
    updateOnlineStatus();
    
    // Mostrar loading
    function showLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '1';
            loadingOverlay.style.pointerEvents = 'auto';
        }
    }
    
    // Ocultar loading
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.pointerEvents = 'none';
        }
    }
    
    // Asignar funciones a window para que sean accesibles
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    
    // Función para mostrar notificaciones
    function showNotification(message, type = 'info') {
        // Check if we have a custom notification function from the HTML
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback notification if no custom function exists
        console.log(`[${type}] ${message}`);
        alert(`${message}`);
    }
    
    // Función para precargar un video
    async function preloadVideo(url, videoName) {
        if (videoCache.has(url)) {
            console.log('Video ya en caché en memoria:', url);
            return videoCache.get(url);
        }
        
        try {
            // Primero intentar recuperar desde IndexedDB
            const cachedVideo = await getVideoFromIndexedDB(url);
            
            if (cachedVideo) {
                console.log('Video recuperado de IndexedDB:', url);
                const objectUrl = URL.createObjectURL(cachedVideo.blob);
                
                // Guardar en caché de memoria también
                videoCache.set(url, {
                    objectUrl: objectUrl,
                    blob: cachedVideo.blob
                });
                
                return videoCache.get(url);
            }
            
            // Si no está en IndexedDB, cargarlo desde la red
            console.log('Precargando video desde la red:', url);
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
            
            // Guardar en caché de memoria
            videoCache.set(url, {
                objectUrl: videoObjectUrl,
                blob: blob
            });
            
            // Guardar en IndexedDB para persistencia
            await saveVideoToIndexedDB(url, blob, videoName);
            
            // Limpiar videos antiguos si hay demasiados
            await cleanupOldVideos();
            
            console.log('Video precargado, en caché de memoria y en IndexedDB:', url);
            hideLoading();
            return videoCache.get(url);
        } catch (error) {
            console.error('Error precargando video:', error);
            hideLoading();
            showNotification('Error al cargar el video', 'error');
            return null;
        }
    }
    
    // Función para reproducir un video desde la URL o la caché
    async function playVideo(url, videoName) {
        currentVideoUrl = url;
        currentVideoName = videoName;
        
        if (currentVideoTitle) {
            currentVideoTitle.innerHTML = `<i class="fas fa-film text-primary text-xl"></i><span>${videoName}</span>`;
        }
        
        // Cargar progreso desde localStorage (respaldo por si falla la sincronización con servidor)
        try {
            const savedProgress = localStorage.getItem(`video_progress_${videoName}`);
            if (savedProgress && !isNaN(parseFloat(savedProgress))) {
                console.log(`Progreso recuperado desde localStorage: ${savedProgress}`);
                // El progreso se aplicará más adelante en la función
            }
        } catch (e) {
            console.log('Error recuperando progreso desde localStorage:', e);
        }
        
        // Scroll hasta el reproductor
        const playerSection = document.getElementById('player-section');
        if (playerSection) {
            playerSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        showLoading();
        
        try {
            // Intentar cargar desde caché (memoria o IndexedDB)
            let cachedVideo;
            
            if (videoCache.has(url)) {
                // Si ya está en memoria
                cachedVideo = videoCache.get(url);
            } else {
                // Intentar recuperar de IndexedDB
                const storedVideo = await getVideoFromIndexedDB(url);
                
                if (storedVideo) {
                    // Crear objectURL del blob almacenado
                    const objectUrl = URL.createObjectURL(storedVideo.blob);
                    cachedVideo = {
                        objectUrl: objectUrl,
                        blob: storedVideo.blob
                    };
                    
                    // Actualizar la caché en memoria
                    videoCache.set(url, cachedVideo);
                } else if (navigator.onLine) {
                    // Si no está en caché pero estamos en línea, cargarlo
                    cachedVideo = await preloadVideo(url, videoName);
                }
            }
            
            if (videoPlayer) {
                if (cachedVideo) {
                    // Usar la versión en caché
                    videoPlayer.src = cachedVideo.objectUrl;
                } else if (navigator.onLine) {
                    // Si no está en caché pero estamos en línea, usar la URL directamente
                    // y precargar para futuras reproducciones
                    videoPlayer.src = url;
                    preloadVideo(url, videoName).catch(e => console.error('Error precargando:', e));
                } else {
                    // Si estamos fuera de línea y no está en caché
                    hideLoading();
                    showNotification('Video no disponible sin conexión', 'error');
                    return;
                }
            }
            
            // Buscar el progreso guardado para este video (con respaldo en localStorage)
            let progress = 0;
            
            // Primero intentar obtener el progreso desde el elemento HTML (valor del servidor)
            const progressElement = document.querySelector(`.group[data-name="${videoName}"] .progress-shine`);
            if (progressElement) {
                const progressWidth = progressElement.style.width;
                if (progressWidth) {
                    progress = parseFloat(progressWidth) / 100;
                }
            }
            
            // Si no hay progreso en el HTML o es muy bajo, verificar localStorage
            if (progress < 0.03) {
                try {
                    const savedProgress = localStorage.getItem(`video_progress_${videoName}`);
                    if (savedProgress && !isNaN(parseFloat(savedProgress))) {
                        const localProgress = parseFloat(savedProgress);
                        // Usar el mayor valor entre el progreso del servidor y localStorage
                        progress = Math.max(progress, localProgress);
                        console.log(`Usando progreso desde localStorage: ${progress.toFixed(2)}`);
                    }
                } catch (e) {
                    console.log('Error al recuperar progreso de localStorage:', e);
                }
            }
            
            // Aplicar el progreso al video
            if (videoPlayer && progress > 0 && progress < 0.95) {  // No saltamos si está casi al final
                videoPlayer.addEventListener('loadedmetadata', function onLoaded() {
                    const seekTime = progress * videoPlayer.duration;
                    videoPlayer.currentTime = seekTime;
                    videoPlayer.removeEventListener('loadedmetadata', onLoaded);
                    hideLoading();
                });
            } else {
                hideLoading();
            }
            
            // Iniciar reproducción
            if (videoPlayer) {
                videoPlayer.play().catch(e => {
                    console.error('Error reproduciendo video:', e);
                    hideLoading();
                });
            }
        } catch (error) {
            console.error('Error cargando video:', error);
            hideLoading();
            showNotification('Error al cargar el video', 'error');
        }
    }
    
    // Exponer la función playVideo a window
    window.playVideo = playVideo;
    
    // Función para descargar el video al PC
    function downloadVideo(url, videoName) {
        // Verificar si el video está en caché
        if (videoCache.has(url)) {
            const cachedVideo = videoCache.get(url);
            
            // Crear un elemento de descarga
            const downloadLink = document.createElement('a');
            downloadLink.href = cachedVideo.objectUrl;
            
            // Asegurarse de que el nombre del archivo tenga la extensión correcta
            let fileName = videoName;
            if (!fileName.includes('.')) {
                // Si no tiene extensión, determinar el tipo de archivo y añadir la extensión
                const mimeType = cachedVideo.blob.type;
                let extension = '.mp4'; // Por defecto
                
                if (mimeType.includes('video/mp4')) extension = '.mp4';
                else if (mimeType.includes('video/webm')) extension = '.webm';
                else if (mimeType.includes('video/ogg')) extension = '.ogg';
                
                fileName += extension;
            }
            
            downloadLink.download = fileName;
            
            // Añadir al documento, hacer clic y luego eliminar
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            showNotification(`Descargando "${fileName}"`, 'success');
        } else {
            // Si no está en caché, intentar cargar primero
            showNotification('Preparando descarga...', 'info');
            
            preloadVideo(url, videoName)
                .then(video => {
                    if (video) {
                        downloadVideo(url, videoName); // Intentar descargar de nuevo
                    } else {
                        showNotification('No se pudo preparar el video para descarga', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error preparando descarga:', error);
                    showNotification('Error al preparar la descarga', 'error');
                });
        }
    }
    
    // Exponer la función downloadVideo a window
    window.downloadVideo = downloadVideo;
    
    // Actualizar progreso de visualización
    async function updateProgress() {
        if (!videoPlayer || !currentVideoName || !videoPlayer.duration || isUpdatingProgress) return;
        
        const progress = videoPlayer.currentTime / videoPlayer.duration;
        if (isNaN(progress)) return;
        
        // Actualizar barra de progreso en la UI
        const progressElement = document.querySelector(`.group[data-name="${currentVideoName}"] .progress-shine`);
        if (progressElement) {
            progressElement.style.width = `${progress * 100}%`;
        }
        
        // Guardar progreso localmente
        try {
            // Guardar en localStorage como respaldo
            localStorage.setItem(`video_progress_${currentVideoName}`, progress.toString());
        } catch (e) {
            console.log('Error guardando progreso en localStorage:', e);
        }
        
        // Si estamos en línea y la sincronización no está deshabilitada, intentar enviar progreso al servidor
        if (navigator.onLine && !progressSyncDisabled && progress > 0) {
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
                    progressSyncErrors++;
                    throw new Error(`Error al actualizar progreso: ${response.status}`);
                } else {
                    // Resetear contador de errores si hay éxito
                    progressSyncErrors = 0;
                }
            } catch (error) {
                console.error('Error guardando progreso:', error);
                
                // Si hay demasiados errores seguidos, deshabilitar sincronización temporalmente
                if (progressSyncErrors >= MAX_SYNC_ERRORS) {
                    progressSyncDisabled = true;
                    console.log('Sincronización de progreso deshabilitada después de múltiples errores');
                    showNotification('Sincronización con el servidor deshabilitada temporalmente. Tu progreso se guarda localmente.', 'info');
                    
                    // Reactivar después de 2 minutos
                    setTimeout(() => {
                        progressSyncDisabled = false;
                        progressSyncErrors = 0;
                        console.log('Sincronización de progreso reactivada');
                    }, 2 * 60 * 1000);
                }
            } finally {
                isUpdatingProgress = false;
            }
        }
    }
    
    // Actualizar progreso periódicamente
    setInterval(updateProgress, 5000);  // Cada 5 segundos
    
    // También actualizar al pausar el video
    if (videoPlayer) {
        videoPlayer.addEventListener('pause', updateProgress);
        
        // Y al terminar el video
        videoPlayer.addEventListener('ended', function() {
            // Marcar como 100% completado
            const progressElement = document.querySelector(`.group[data-name="${currentVideoName}"] .progress-shine`);
            if (progressElement) {
                progressElement.style.width = '100%';
            }
            updateProgress();
            showNotification('Reproducción completada', 'success');
        });
        
        // Eventos de carga del video
        videoPlayer.addEventListener('waiting', showLoading);
        videoPlayer.addEventListener('playing', hideLoading);
    }
    
    // Agregar eventos de clic a cada tarjeta de video
    videoCards.forEach(card => {
        const videoUrl = card.getAttribute('data-src');
        const videoName = card.getAttribute('data-name');
        
        if (videoUrl && videoName) {
            card.addEventListener('click', function() {
                playVideo(videoUrl, videoName);
            });
        }
    });
    
    // Si el video actual se detiene porque se terminó el buffer pero estamos fuera de línea,
    // intentar reanudar desde donde quedó usando la caché
    if (videoPlayer) {
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
    }
    
    // Inicializar IndexedDB al cargar la página
    initIndexedDB().catch(error => {
        console.error('Error inicializando IndexedDB:', error);
        showNotification('No se pudo inicializar el almacenamiento local', 'error');
    });
    
    // Mostrar espacio disponible en localStorage
    function checkStorageSpace() {
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                const usedSpaceMB = Math.round(estimate.usage / (1024 * 1024));
                const totalSpaceMB = Math.round(estimate.quota / (1024 * 1024));
                const usedPercentage = Math.round((estimate.usage / estimate.quota) * 100);
                
                console.log(`Espacio de almacenamiento: ${usedSpaceMB}MB / ${totalSpaceMB}MB (${usedPercentage}%)`);
                
                // Añadir información de almacenamiento al estado de conexión
                if (connectionStatus) {
                    connectionStatus.setAttribute('title', `Almacenamiento local: ${usedSpaceMB}MB / ${totalSpaceMB}MB (${usedPercentage}%)`);
                }
            });
        }
    }
    
    // Comprobar espacio de almacenamiento al inicio
    checkStorageSpace();
    
    // Y periódicamente (cada 5 minutos)
    setInterval(checkStorageSpace, 5 * 60 * 1000);
    
    // Inicializar la lista de videos en caché
    async function updateCachedVideosList() {
        const cachedVideosListElement = document.getElementById('cached-videos-list');
        if (!cachedVideosListElement || !db) {
            return;
        }
        
        try {
            // Obtener todos los videos de IndexedDB
            const transaction = db.transaction([videoStoreName], 'readonly');
            const store = transaction.objectStore(videoStoreName);
            const request = store.getAll();
            
            request.onsuccess = function(event) {
                const videos = event.target.result;
                
                if (videos.length === 0) {
                    cachedVideosListElement.innerHTML = '<p class="text-light/70">No hay videos guardados actualmente</p>';
                } else {
                    // Calcular el tamaño total
                    let totalSizeMB = 0;
                    
                    let html = '';
                    videos.forEach(video => {
                        const sizeMB = Math.round(video.blob.size / (1024 * 1024) * 10) / 10;
                        totalSizeMB += sizeMB;
                        
                        // Convertir timestamp a fecha legible
                        const date = new Date(video.timestamp);
                        const formattedDate = date.toLocaleString();
                        
                        html += `
                        <div class="flex justify-between items-center p-4 bg-dark/40 rounded-xl mb-4 border border-white/5 hover:bg-dark/60 hover:translate-x-1 transition-all duration-300">
                            <div class="flex-1 overflow-hidden">
                                <strong class="text-light block truncate">${video.videoName || 'Video sin nombre'}</strong>
                                <small class="text-light/70">${sizeMB} MB - Guardado: ${formattedDate}</small>
                            </div>
                            <div class="flex gap-2">
                                <button class="download-cached-btn p-2 rounded-lg bg-gradient-to-r from-success to-info text-white hover:-translate-y-1 transition-all duration-300" data-url="${video.videoUrl}" data-name="${video.videoName || 'video'}">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="delete-cached-btn p-2 rounded-lg bg-gradient-to-r from-error to-accent text-white hover:-translate-y-1 transition-all duration-300" data-url="${video.videoUrl}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>`;
                    });
                    
                    cachedVideosListElement.innerHTML = html;
                    
                    // Actualizar información de almacenamiento
                    updateStorageInfo(totalSizeMB, videos.length);
                    
                    // Añadir eventos a los botones
                    cachedVideosListElement.querySelectorAll('.download-cached-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const url = btn.getAttribute('data-url');
                            const name = btn.getAttribute('data-name');
                            if (url && name) {
                                downloadVideo(url, name);
                            }
                        });
                    });
                    
                    cachedVideosListElement.querySelectorAll('.delete-cached-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const url = btn.getAttribute('data-url');
                            if (url) {
                                deleteVideoFromCache(url).then(() => {
                                    updateCachedVideosList();
                                });
                            }
                        });
                    });
                }
            };
            
            request.onerror = function(event) {
                console.error('Error al obtener videos de IndexedDB:', event.target.error);
                cachedVideosListElement.innerHTML = '<p class="text-error">Error al cargar los videos guardados</p>';
            };
        } catch (error) {
            console.error('Error al listar videos en caché:', error);
            cachedVideosListElement.innerHTML = '<p class="text-error">Error al cargar los videos guardados</p>';
        }
    }
    
    // Función para actualizar la información de almacenamiento
    function updateStorageInfo(usedSizeMB, videoCount) {
        const storageInfoElement = document.getElementById('storage-info');
        if (!storageInfoElement) return;
        
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                const totalSpaceMB = Math.round(estimate.quota / (1024 * 1024));
                const usedPercentage = Math.round((usedSizeMB / totalSpaceMB) * 100);
                
                storageInfoElement.innerHTML = `
                    <h4 class="text-xl font-semibold mb-3 text-gradient">Información de Almacenamiento</h4>
                    <p class="mb-2 text-light/80">Espacio utilizado por videos: ${usedSizeMB.toFixed(1)} MB de ${totalSpaceMB} MB (${usedPercentage}%)</p>
                    <p class="mb-4 text-light/80">Número de videos guardados: ${videoCount}</p>
                    <button id="clear-all-cache" class="w-full p-3 rounded-lg bg-gradient-to-r from-error to-accent text-white font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex items-center justify-center gap-2">
                        <i class="fas fa-trash-alt"></i> Eliminar todos los videos guardados
                    </button>
                `;
                
                // Añadir evento para limpiar toda la caché
                document.getElementById('clear-all-cache')?.addEventListener('click', () => {
                    if (confirm('¿Estás seguro de que deseas eliminar todos los videos guardados?')) {
                        clearAllVideosFromCache().then(() => {
                            updateCachedVideosList();
                            showNotification('Todos los videos han sido eliminados del almacenamiento', 'success');
                        });
                    }
                });
            });
        } else {
            storageInfoElement.innerHTML = `
                <h4 class="text-xl font-semibold mb-3 text-gradient">Información de Almacenamiento</h4>
                <p class="mb-2 text-light/80">Espacio utilizado por videos: ${usedSizeMB.toFixed(1)} MB</p>
                <p class="mb-4 text-light/80">Número de videos guardados: ${videoCount}</p>
                <button id="clear-all-cache" class="w-full p-3 rounded-lg bg-gradient-to-r from-error to-accent text-white font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex items-center justify-center gap-2">
                    <i class="fas fa-trash-alt"></i> Eliminar todos los videos guardados
                </button>
            `;
            
            // Añadir evento para limpiar toda la caché
            document.getElementById('clear-all-cache')?.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que deseas eliminar todos los videos guardados?')) {
                    clearAllVideosFromCache().then(() => {
                        updateCachedVideosList();
                        showNotification('Todos los videos han sido eliminados del almacenamiento', 'success');
                    });
                }
            });
        }
    }
    
    // Función para eliminar un video de la caché
    function deleteVideoFromCache(videoUrl) {
        return new Promise((resolve, reject) => {
            try {
                if (!db) {
                    return reject(new Error('IndexedDB no está disponible'));
                }
                
                // Eliminar de IndexedDB
                const transaction = db.transaction([videoStoreName], 'readwrite');
                const store = transaction.objectStore(videoStoreName);
                const request = store.delete(videoUrl);
                
                request.onsuccess = function() {
                    console.log('Video eliminado de IndexedDB:', videoUrl);
                    
                    // También eliminar de la caché en memoria
                    if (videoCache.has(videoUrl)) {
                        // Revocar el objectURL para liberar memoria
                        URL.revokeObjectURL(videoCache.get(videoUrl).objectUrl);
                        videoCache.delete(videoUrl);
                    }
                    
                    showNotification('Video eliminado del almacenamiento', 'success');
                    resolve();
                };
                
                request.onerror = function(event) {
                    console.error('Error al eliminar video de IndexedDB:', event.target.error);
                    showNotification('Error al eliminar el video', 'error');
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Error eliminando video de caché:', error);
                showNotification('Error al eliminar el video', 'error');
                reject(error);
            }
        });
    }
    
    // Función para eliminar todos los videos de la caché
    function clearAllVideosFromCache() {
        return new Promise((resolve, reject) => {
            try {
                if (!db) {
                    return reject(new Error('IndexedDB no está disponible'));
                }
                
                // Eliminar todo de IndexedDB
                const transaction = db.transaction([videoStoreName], 'readwrite');
                const store = transaction.objectStore(videoStoreName);
                const request = store.clear();
                
                request.onsuccess = function() {
                    console.log('Todos los videos eliminados de IndexedDB');
                    
                    // Limpiar también la caché en memoria
                    for (const [url, data] of videoCache.entries()) {
                        // Revocar los objectURLs para liberar memoria
                        URL.revokeObjectURL(data.objectUrl);
                    }
                    videoCache.clear();
                    
                    resolve();
                };
                
                request.onerror = function(event) {
                    console.error('Error al eliminar todos los videos de IndexedDB:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Error eliminando todos los videos de la caché:', error);
                reject(error);
            }
        });
    }
    
    // Actualizar la lista de videos en caché cuando se abre el modal
    const openCacheModalBtn = document.getElementById('cached-videos-btn');
    if (openCacheModalBtn) {
        openCacheModalBtn.addEventListener('click', updateCachedVideosList);
    }
});