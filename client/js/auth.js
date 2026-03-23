// FUNZIONI DI AUTENTICAZIONE E GESTIONE UTENTE

// ottieni utente corrente dal token
async function getUser() {
    const result = await apiGet(CONFIG.ENDPOINTS.PROFILE);
    return result.success ? result.data.user : null; //altrimenti restituisce null
}

// verifica se utente è loggato... inutile se uso le altre funzioni sotto
/*
async function isLoggedIn() {
    const user = await getUser();
    return user !== null;
}
*/


async function login(email, password) {
    const result = await apiPost(CONFIG.ENDPOINTS.LOGIN, { email, password });
    
    if (result.success) {
        return { success: true, user: result.data.user };
    } else {
        return { success: false, message: result.error };
    }
}

// LOGOUT
/* aveva dei problemi con il back navigation dopo il logout (pagine accessibili tornando indietro dopo il logout)

    - CACHE DEL BROWSER: browser caricava la pagina dalla bfcache (back forward cache) senza fare una nuova richiesta al server, 
    quindi l'utente vedeva ancora la pagina autenticata.

    ---> SOLUZIONE
        - window.onpageshow per rilevare caricamenti da cache 
        - nascondere contenuto (opacity 0)
        - ricaricare la pagina, cosi riparte il controllo di autenticazione . forzare il controllo di autenticazione. 
        (dovrebbe cosi rilevare che l'utente non è più loggato e fare redirect a login.html)

    - RACE CONDITION tra auth.js e le alter pagine js (es: ordini.js): anche gestendo la cache le pagin ejs partivano in parallelo
    con auth.js e provava a caricare i dati prima che l'autenticazione fosse verificata. mostrava quindi dati non corretti/mostrava 
    pagine protette (anche dicendo ''errori nel caricamento dati.) 

    ---> SOLUZIONE
        - ordini.js e profilo.js ora aspettano che auth.js completi
        - verificano che esista la classe auth-verified prima di caricare dati
        - se non c'è autenticazione, non caricano nulla (niente errori). 
        vedi nei rispettivi file js per i dettagli.

     situazione LOGOUT : torna indietro:
        - Browser carica pagina da cache (bfcache)
        - window.onpageshow rileva event.persisted 
        - nasconde body (opacity: 0) 
        - ricarica pagina
        - auth.js controlla autenticazione → FALLISCE
        - redirect a login.html 
        - ordini.js/profilo.js/altre pagine js NON caricano dati 

*/
async function logout() {
    // chiama endpoint di logout per cancellare il cookie
    await apiPost(CONFIG.ENDPOINTS.LOGOUT);
    
    // cancella eventuali dati locali in cache
    sessionStorage.clear();
    localStorage.clear();
    
    //nascondi immediatamente il contenuto della pagina
    document.body.style.opacity = '0';
    document.body.classList.remove('auth-verified');
    
    // impedisci che tornando indietro si veda la pagina autenticata
    window.onpageshow = function(event) {
        if (event.persisted) {
            console.log('Tentativo di accesso a pagina dopo logout - blocco');
            document.body.style.opacity = '0'; //nasscondi contenuto 
            window.location.reload();
        }
    };
    
    window.alert('✅ Logout effettuato con successo');
    
    // replace invece di href per evitare che si possa tornare indietro alla pagina protetta
    window.location.replace('/index.html');
}


async function register(userData) {
    const result = await apiPost(CONFIG.ENDPOINTS.REGISTER, userData);
    
    if (result.success) {
        return { success: true, user: result.data.user };
    } else {
        return { 
            success: false, 
            message: result.error,
            validationErrors: result.validationErrors
        };
    }
}

// protegge una pagina richiedendo autenticazione e ruolo specifico

//verifica se è loggato, se no va al login, se si ritorna user.
//  se è loggato ma ruolo non autorizzato va alla sua home (diversa per cliente e ristorante)
async function requireAuth(allowedRoles = null) {
    const user = await getUser();
    
    // non loggato -> vai al login
    if (!user) {
        window.location.href = '/login.html';
        return null;
    }
    
    // se è specificato un ruolo richiesto, controlla
    if (allowedRoles) {
        //metodo js che da true se allowedRoles è un array, altrimenti lo trasforma in array (es. se è una stringa singola)
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        
        //controllo se il ruolo dell'utente è incluso nei ruoli autorizzati(es. se allowedRoles è 'ristorante' e user.ruolo è 'cliente', non è autorizzato)
        if (!roles.includes(user.ruolo)) {
            // ruolo non autorizzato -> reindirizza alla sua home, cambia in base al ruolo
            if (user.ruolo === CONFIG.ROLES.CLIENTE) {
                window.location.href = '/cliente/ristoranti.html';
            } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
                window.location.href = '/ristorante/dashboard.html';
            }
            return null;
        }
    }
    
    return user;
}

// nascondi bottoni accedi e profilo dalla navbar se non loggato, mostra se loggato
async function toggleNavAccedi() {
    try {
        const user = await getUser();

        const navAccedi = document.getElementById('nav-accedi');
        const profiloNavbar = document.getElementById('profiloNavbar');

        if (!user) { //se non loggato:
            
            if (navAccedi) navAccedi.style.display = 'block'; //mostra accedi 
            if (profiloNavbar) profiloNavbar.style.display = 'none'; //nascondi profilo diverso da hidden che occuperebbe ancora lo spazio
        } else { //se loggato:
            
            if (navAccedi) navAccedi.style.display = 'none'; //nascondi accedi se loggato, nascondi profilo
            if (profiloNavbar) profiloNavbar.style.display = 'block';
        }

       
    }     catch (error) {
        console.error('Errore nel controllo sessione utente:', error);
    }
}

// AUTO-ROUTING: gestisce automaticamente i redirect in base alla pagina corrente
// si esegue automaticamente quando auth.js viene caricato (cioe per tutte le pagine che includono auth)
(function autoRouting() {
    document.addEventListener('DOMContentLoaded', async () => {
        const currentPath = window.location.pathname;
        console.log('Auto-routing - Path corrente:', currentPath);
        
        const user = await getUser();
        console.log(' Utente:', user);
        
        // nascondi link bottone accedi" se loggato
        toggleNavAccedi();
        

        
        /*
        NB:
        
        il server express è configurato con app.use(express.static('../client')),
         che significa che la cartella client è già la root per i file statici. 
         quindi quando il browser richiede /cliente/ristoranti.html, express lo serve come ristoranti.html.
         non serve specificare /client/ nel percorso quando reindirizzo, perché client è già la base 
         per i file statici.

        redirect con path assoluto (es: /cliente/ristoranti.html) invece di relativo (cliente/ristoranti.html) per evitare 
        problemi di path in caso di pagine in sottocartelle (es: se sono in /ristorante/dashboard.html e faccio redirect a
         cliente/ristoranti.html, il browser cercherebbe /ristorante/cliente/ristoranti.html che non esiste).
         usando path assoluti, il browser sa di cercare sempre dalla root (che è client) e non ci sono problemi di path.
         es: window.location.href = '/cliente/ristoranti.html' funziona da qualsiasi pagina, mentre window.location.href = 'cliente/ristoranti.html'
          funziona solo se sei già nella root o in una pagina che non è in una sottocartella.
         */
        

        // INDEX.HTML - pagina pubblica, ma reindirizza SOLO i ristoranti
        if (currentPath.endsWith('/index.html') || currentPath === '/' || currentPath.endsWith('/cliente/')) {
            if (user) {
                console.log('Utente loggato su index');
                if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
                    console.log('Ristorante -> redirect a dashboard');
                    window.location.replace('/ristorante/dashboard.html');
                }
                // i clienti possono rimanere su index.html
            }
            return;
        }
        
        // LOGIN/REGISTRAZIONE - se già loggato, reindirizza 
        if (currentPath.endsWith('/login.html') || currentPath.endsWith('/registrazione.html')) {
            if (user) {
                console.log('Utente già loggato su login/registrazione');
                if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
                    console.log('Ristorante -> redirect a dashboard');
                    window.location.replace('/ristorante/dashboard.html');
                }else if (user.ruolo === CONFIG.ROLES.CLIENTE) {
                    console.log('Cliente -> redirect a ristoranti');
                    window.location.replace('/cliente/ristoranti.html');
                }
                
            }
            return;
        }
        
        // PAGINE RISTORANTE - solo per ristoranti
        if (currentPath.includes('/ristorante/')) {
            // SEMPRE imposta il controllo cache, anche per utenti autenticati
            window.onpageshow = function(event) {
                if (event.persisted) { //persisted cioè se la pagina è stata caricata da cache (bfcache)
                    console.log('Pagina caricata da cache - controllo autenticazione');
                    // nascondi immediatamente il contenuto
                    document.body.style.opacity = '0';
                    document.body.classList.remove('auth-verified');
                    // ricarica per verificare lo stato di autenticazione
                    window.location.reload();
                }
            };
            
            if (!user) {
                console.log('Non loggato, redirect a login');
                // redirect immediato senza possibilità di tornare indietro
                window.location.replace('/login.html');
                // blocca completamente l'esecuzione
                throw new Error('Unauthorized access');
            } else if (user.ruolo !== CONFIG.ROLES.RISTORANTE) {
                console.log('❌ Non sei un ristorante, redirect a cliente');
                window.location.replace('/cliente/ristoranti.html');
                throw new Error('Unauthorized access');
            } else {
                console.log('Ristorante autenticato, OK');
                // mostra il contenuto della pagina
                document.body.classList.add('auth-verified');
            }
            return;
        }
        
        // PAGINE CLIENTE - solo per clienti.logica simile a ristorante, ma con redirect diversi
        if (currentPath.includes('/cliente/')) {
            
            window.onpageshow = function(event) {
                if (event.persisted) {
                    console.log('Pagina caricata da cache - controllo autenticazione');
                   
                    document.body.style.opacity = '0';
                    document.body.classList.remove('auth-verified');
                   
                    window.location.reload();
                }
            };
            
            if (!user) {
                console.log('Non loggato, redirect a login');
                
                window.location.replace('/login.html');
               
                throw new Error('Unauthorized access');
            } else if (user.ruolo !== CONFIG.ROLES.CLIENTE) {
                console.log(' Non sei un cliente, redirect a ristorante');
                window.location.replace('/ristorante/dashboard.html');
                throw new Error('Unauthorized access');
            } else {
                console.log('Cliente autenticato, OK');
        
                document.body.classList.add('auth-verified');
            }
            return;
        }
    });
})(); //parentesi per falra partire subito, no chiamate esplicite
