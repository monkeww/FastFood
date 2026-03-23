// funzioni utility condivise

// formatta data in italiano
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// formatta prezzo
function formatPrice(price) {
    return `€${parseFloat(price).toFixed(2)}`;
}

// mostra toast/notifica
function showToast(message, type = 'info') {
    // implementazione semplice con alert e libtreria emoji
    const emoji = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    alert(`${emoji[type]} ${message}`);
}

// mostra loading spinner
function showLoading(show = true) {
    let loader = document.getElementById('loader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader';
        loader.className = 'loader';
        loader.innerHTML = '<div class="spinner" >Caricamento...</div>';
        document.body.appendChild(loader);
    }
    
    loader.style.display = show ? 'flex' : 'none';
}

// ottieni parametro da URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

//badge per stato ordine
function getStatusBadge(stato) {
    const badges = {
        'ordinato': '<span class="badge bg-primary">Ordinato</span>',
        'in preparazione': '<span class="badge bg-warning">In preparazione</span>',
        'pronto': '<span class="badge bg-info">Pronto</span>',
        'in consegna': '<span class="badge bg-secondary">In consegna</span>',
        'consegnato': '<span class="badge bg-success">Consegnato</span>',
        'annullato': '<span class="badge bg-danger">Annullato</span>'
    };
    return badges[stato] || `<span class="badge bg-light">${stato}</span>`;
}

// sanitize HTML per prevenire XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// debounce per ricerca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


//helper delay
    //------------------------------------------------------------ 
    // attendiamo che auth.js completi il controllo di autenticazione
    // (auth.js aggiunge la classe 'auth-verified' quando OK)

    //come funziona: 
    /*
    await new promise... Questa riga pausa l'esecuzione per 100 millisecondi (0.1 secondi).

    - new Promise(resolve => ...):  Crea una Promise (promessa asincrona)
    -setTimeout(resolve, 100):  Dopo 100ms risolve la promessa
    - await:  aspetta che la promessa si risolva prima di continuare (100ms)
    -Il setTimeout scade e chiama la funzione resolve(). Appena resolve() viene chiamata, la Promessa è "mantenuta".
    - L'await si "sblocca" e l'esecuzione continua (in questo caso, fa attempts++ e ricomincia il while).
    - per dare tempo ad auth.js di completare il controllo senza bloccare il browser.
    -

    esempio del ciclo: 100 tentativi massimi (10 secondi)
    TENTATIVO 1 (0.1s): auth-verified? NO → aspetta 100ms
    TENTATIVO 2 (0.2s): auth-verified? NO → aspetta 100ms
    ...
    TENTATIVO 15 (1.5s): auth-verified? Si → ESCE DAL CICLO

    se non fosse una promise, non potremmo usare await e freezerebbe tutto il browser.
     aspetta 100ms (e nel frattempo il browser è libero di fare altro, come eseguire lo 
     script di autenticazione). aspetti a intervalli di 100ms fino a un massimo di 10 secondi

    FUNZIONE ESTESA:
    new Promise( 
    //  la funzione "esecutore"
        function(resolve, reject) { 
            // il corpo della funzione
            setTimeout(resolve, 100); 
        
        //  ignorando 'reject' perché non serve
    } 

        TEMPO    | COSA SUCCEDE
    ---------|------------------------------------------
    0ms      | new Promise(...) -> Promessa creata
    0ms      | setTimeout(resolve, 100) -> Timer avviato 
    0-100ms  | await aspetta... 
    100ms    | setTimeout chiama resolve() 
    100ms    | await si sblocca e continua 
);
    */

function delay(ms) {
    //await new Promise(resolve => setTimeout(resolve, 100));

    // ritorna una Promise che si risolve dopo 'ms' millisecondi.
    // questo permette di usare "await delay(1000)" per "mettere in pausa" l'esecuzione di una funzione asincrona per 1 secondo.
    return new Promise((resolve) => {
    //  resolve è solo un NOME 
    //                  JavaScript  passa una funzione con questo nome (Di default è resolve)
    //                  io la chiamo quando ho finito
        setTimeout(() => {
            // setTimeout esegue la funzione resolve () passata dopo il tempo indicato.
            // Chiamiamo resolve() (CALLBACK) per indicare che la Promise è completata e l'esecuzione può proseguire. await sbloccato
            resolve();  // () => {...}Perché setTimeout ha bisogno di una funzione da chiamare dopo, non di un valore immediato.
        }, ms);
    });
}


// attendi verifica autenticazione prima di loadare il contenuto di pagine protette
async function waitAuthVerification() {
    const maxWait = 100;
    let attempts = 0;

    while (!document.body.classList.contains('auth-verified') && attempts < maxWait) {
        await delay(100);
        attempts++;
    }
    if (!document.body.classList.contains('auth-verified')) {
        console.error('Autenticazione non verificata - stop caricamento ordini');
        return;
    }else {
        return true;
    }
}