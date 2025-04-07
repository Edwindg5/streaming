// animations.js para NetoFlix con Tailwind CSS
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando animaciones para NetoFlix con Tailwind');
    
    // Verificar que GSAP esté disponible
    if (typeof gsap === 'undefined') {
        console.warn('GSAP no está disponible. Las animaciones avanzadas no funcionarán.');
        return;
    }

    // Registrar el plugin ScrollTrigger si está disponible
    if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        console.log('ScrollTrigger registrado correctamente');
    }
    
    // Animación de entrada de página
    const pageTransition = document.querySelector('.page-transition');
    if (pageTransition) {
        const loadingTimeline = gsap.timeline();
        
        loadingTimeline.fromTo(pageTransition, 
            {
                scaleY: 1,
                transformOrigin: 'bottom'
            }, 
            {
                scaleY: 0,
                transformOrigin: 'bottom',
                duration: 1.2,
                ease: 'power4.out'
            }
        );
    }

    // Animaciones de entrada para el header
    const header = document.querySelector('header');
    if (header) {
        gsap.from(header, {
            y: -100,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
            delay: 0.5
        });
    }
    
    // Animación del texto del héroe
    const heroTitle = document.querySelector('.hero-section h1, .split-text');
    if (heroTitle) {
        // Dividir el texto en caracteres para animación
        const heroText = heroTitle.textContent;
        let splitText = '';
        
        for (let i = 0; i < heroText.length; i++) {
            if (heroText[i] === ' ') {
                splitText += ' ';
            } else {
                splitText += `<span class="inline-block opacity-0 translate-y-full">${heroText[i]}</span>`;
            }
        }
        
        heroTitle.innerHTML = splitText;
        
        // Animar cada letra
        const titleChars = heroTitle.querySelectorAll('span');
        if (titleChars.length > 0) {
            gsap.to(titleChars, {
                y: 0,
                opacity: 1,
                stagger: 0.03,
                duration: 0.8,
                ease: 'power3.out',
                delay: 0.8
            });
        }
    }
    
    // Animación de la descripción del héroe
    const heroDescription = document.querySelector('.hero-section p, .hero-description');
    if (heroDescription) {
        gsap.from(heroDescription, {
            opacity: 0,
            y: 30,
            duration: 0.8,
            delay: 1.2,
            ease: 'power2.out'
        });
    }
    
    // Animación del estado de conexión
    const connectionStatus = document.querySelector('#connection-status');
    if (connectionStatus) {
        gsap.from(connectionStatus, {
            opacity: 0,
            x: 50,
            duration: 0.6,
            delay: 1.4,
            ease: 'back.out(1.7)'
        });
    }
    
    // Animar sección del reproductor con ScrollTrigger
    const playerSection = document.querySelector('#player-section');
    if (playerSection) {
        if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
            gsap.from(playerSection, {
                scrollTrigger: {
                    trigger: playerSection,
                    start: 'top 80%',
                    end: 'top 50%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                y: 50,
                duration: 0.8,
                ease: 'power2.out'
            });
        } else {
            gsap.from(playerSection, {
                opacity: 0,
                y: 50,
                duration: 0.8,
                ease: 'power2.out',
                delay: 0.3
            });
        }
    }
    
    // Animación del botón de caché
    const cacheBtn = document.querySelector('#cached-videos-btn');
    if (cacheBtn) {
        gsap.from(cacheBtn, {
            opacity: 0,
            y: 20,
            duration: 0.6,
            delay: 0.2,
            ease: 'power2.out'
        });
    }
    
    // Animación del título de la sección de videos
    const sectionTitle = document.querySelector('.reveal-text');
    if (sectionTitle) {
        if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
            gsap.fromTo(sectionTitle, 
                { 
                    opacity: 0,
                    y: 30
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    scrollTrigger: {
                        trigger: sectionTitle,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    }
                }
            );
        } else {
            gsap.from(sectionTitle, {
                opacity: 0,
                y: 30,
                duration: 0.8,
                delay: 0.5
            });
        }
    }
    
    // Animación escalonada de las tarjetas de video
    const videoCards = document.querySelectorAll('.video-card');
    if (videoCards.length > 0) {
        if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
            gsap.from(videoCards, {
                scrollTrigger: {
                    trigger: '#video-grid',
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                opacity: 0,
                y: 50,
                stagger: 0.1,
                duration: 0.7,
                ease: 'power2.out'
            });
        } else {
            gsap.from(videoCards, {
                opacity: 0,
                y: 50,
                stagger: 0.1,
                duration: 0.7,
                delay: 0.8,
                ease: 'power2.out'
            });
        }
    }
    
    // Modal de gestión de caché
    const cacheModal = document.getElementById('cache-modal');
    const modalContent = cacheModal ? cacheModal.querySelector('.relative') : null;
    const openModalBtn = document.getElementById('cached-videos-btn');
    const closeModalBtn = document.getElementById('close-modal');
    
    function openModal() {
        if (!cacheModal) return;
        
        // Mostrar el modal con flex
        cacheModal.style.display = 'flex';
        
        // Animar el contenido
        if (modalContent) {
            gsap.to(modalContent, {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: 'back.out(1.7)'
            });
        }
    }
    
    function closeModal() {
        if (!cacheModal || !modalContent) return;
        
        gsap.to(modalContent, {
            scale: 0.95,
            opacity: 0,
            duration: 0.4,
            ease: 'power3.in',
            onComplete: () => {
                cacheModal.style.display = 'none';
            }
        });
    }
    
    // Eventos para abrir/cerrar modal
    if (openModalBtn) {
        openModalBtn.addEventListener('click', openModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    if (cacheModal) {
        cacheModal.addEventListener('click', (e) => {
            if (e.target === cacheModal) {
                closeModal();
            }
        });
    }
    
    // Función para animar notificaciones
    function animateNotification(notification) {
        if (!notification) return;
        
        gsap.fromTo(notification, 
            {
                x: 100,
                opacity: 0,
                scale: 0.9
            },
            {
                x: 0,
                opacity: 1,
                scale: 1,
                duration: 0.6,
                ease: 'back.out(1.7)'
            }
        );
        
        // Auto-ocultar después de 5 segundos
        gsap.to(notification, {
            opacity: 0,
            x: 20,
            duration: 0.5,
            delay: 5,
            ease: 'power3.in',
            onComplete: () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }
        });
    }
    
    // Exponer la función para que main.js pueda usarla
    window.animateNotification = animateNotification;
    
    // Animar las notificaciones existentes
    const existingNotifications = document.querySelectorAll('.message');
    if (existingNotifications.length > 0) {
        existingNotifications.forEach(notification => {
            animateNotification(notification);
        });
    }
    
    // Función para animar la reproducción de video
    window.animateVideoPlay = function() {
        const playerSection = document.getElementById('player-section');
        if (!playerSection) return;
        
        gsap.to(playerSection, {
            boxShadow: '0 25px 50px -12px rgba(58, 134, 255, 0.3)',
            duration: 0.8,
            ease: 'power2.out'
        });
        
        const videoTitle = document.getElementById('current-video-title');
        if (videoTitle) {
            gsap.from(videoTitle, {
                color: '#4cc9f0',
                duration: 1,
                ease: 'power1.inOut'
            });
        }
    };
    
    // Detectar scroll para cambiar el header
    const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (header) {
            if (scrollTop > 20) {
                header.classList.add('h-16');
                header.classList.remove('h-20');
            } else {
                header.classList.add('h-20');
                header.classList.remove('h-16');
            }
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Mejorar la UI móvil
    const checkMobile = () => {
        const videoGrid = document.getElementById('video-grid');
        if (window.innerWidth < 640 && videoGrid) {
            videoGrid.classList.replace('gap-6', 'gap-4');
        } else if (videoGrid) {
            videoGrid.classList.replace('gap-4', 'gap-6');
        }
    };
    
    window.addEventListener('resize', checkMobile);
    checkMobile();
    
    console.log('Inicialización de animaciones Tailwind/GSAP completada');
});