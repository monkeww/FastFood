// Gestione pagina login

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // chiamata alla funzione login di auth.js
        const result = await login(email, password);
        
        if (result.success) {
            // reindirizza in base al ruolo
            if (result.user.ruolo === CONFIG.ROLES.RISTORANTE) {
                window.location.href = '/ristorante/dashboard.html';
            } else if (result.user.ruolo === CONFIG.ROLES.CLIENTE) {
                window.location.href = '/cliente/ristoranti.html';
            }
        } else {
            
            alert(' Errore' + result.message);
        }
    });
});

// password toggle function
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = document.getElementById('icon-' + fieldId);
  
  if (field.type === 'password') {
    field.type = 'text';
    icon.classList.remove('bi-eye');
    icon.classList.add('bi-eye-slash');
  } else {
    field.type = 'password';
    icon.classList.add('bi-eye');
    icon.classList.remove('bi-eye-slash');
  }
}
