// static/js/register.js
document.addEventListener('DOMContentLoaded', function() {
    // Animación para los mensajes de alerta
    const messages = document.querySelectorAll('.message');
    
    messages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.style.display = 'none';
            }, 300);
        }, 5000);
    });

    // Validación de formulario adicional (opcional)
    const registerForm = document.querySelector('form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!username || !email || !password) {
                e.preventDefault();
                alert('Por favor complete todos los campos');
            }
        });
    }
});