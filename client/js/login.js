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
