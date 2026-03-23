/**
 * API.JS - Wrapper per chiamate API.
Questo file centralizza tutte le chiamate fetch() al backend per evitare codice ripetitivo.
  
- senza questo file, ogni chiamata API richiederebbe 15-20 righe di codice ripetitivo,
 bisognerebbe gestire manualmente
headers, credentials, parsing JSON, errori
--> Codice duplicato in decine di posti diversi
  
 Soluzione:
 -  apiCall() è la funzione base che gestisce tutto cio che serve per una chiamaata API:
 -   aggiunge automaticamente credentials: 'include' (per i cookie JWT)
 -   aggiunge automaticamente Content-Type: application/json
 -   costruisce l'URL completo combinando CONFIG.API_BASE_URL + endpoint
 -   fa il parsing JSON della risposta
 -   gestisce errori di rete e risposta
 -   ritorna sempre { success: true/false, data/error }
  
 - funzioni apiGet, apiPost, apiPatch, apiDelete sono scorciatoie comode
    che chiamano apiCall() con il metodo HTTP corretto
  
 
   // prima, sarebbero tante righe per chiamare l'api:
    const response = await fetch('http://localhost:3000/api/orders', {
       method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) { ... gestione errori ... }
 
    // Dopo (1 riga):
    const { success, data, error } = await apiGet('/orders');

 */

// wrapper generico per chiamate API

//endpoint: string (es. '/meals')
//options: oggetto fetch options, dettagli aggiuntivi (method, body, ecc.)
async function apiCall(endpoint, options = {}) {
    //crea modello standard per tutte le chiamate
    const defaultOptions = {
        credentials: 'include', //mandare sempre cookie, se utente loggato viene inviato il cookie
        headers: {          //contiene informazioni su tipo di dato che sto inviando al server
            'Content-Type': 'application/json',
            //Spread operator se passo headers personalizzati, li unisce qui. es: se metti 
            // headers: { 'Authorization': 'Bearer token' }, verrà aggiunto
            ...options.headers
        }
    };
    
    //fonde defaultoptions (quello sopra) con le options passate alla funzione (mie)
    /* esempio
        // chiamata:
        apiCall('/login', { method: 'POST', body: '...' })

        // risultato:
        finalOptions = {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: '...'
        }
    */
    const finalOptions = { ...defaultOptions, ...options }; 
    
    // ${CONFIG.API_BASE_URL} è l'url base (http://localhost:3000) e endpoint è es: /meals
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, finalOptions);
        const data = await response.json();
        
        if (response.ok) {
            return { success: true, data };
        } else {
            // gestisci errori di validazione specifici
            if (data.errori && Array.isArray(data.errori)) {
                const erroriFormattati = data.errori.map(err => `${err.campo}: ${err.messaggio}`).join('\n');
                return { success: false, error: erroriFormattati, validationErrors: data.errori };
            }
            return { success: false, error: data.message || data.error || 'Errore sconosciuto' };
        }
    } catch (error) {
        console.error('Errore API:', error);
        return { success: false, error: 'Errore di connessione' };
    }
}

//funzioni che chiamano apiCall con metodo specifico, per comodità e leggibilità del codice, così da 
// non dover specificare ogni volta il metodo nelle options

// shortcut per GET
async function apiGet(endpoint) {
    return apiCall(endpoint, { 
        method: 'GET' 
    });
}

// shortcut per POST
async function apiPost(endpoint, body) {
    return apiCall(endpoint, {
        method: 'POST',             //qui nelle options specifico metodo e body
        body: JSON.stringify(body)
    });
}

// shortcut per PATCH
async function apiPatch(endpoint, body) {
    return apiCall(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}

// shortcut per PUT
async function apiPut(endpoint, body) {
    return apiCall(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

// shortcut per DELETE
async function apiDelete(endpoint) {
    return apiCall(endpoint, { 
        method: 'DELETE' 
    });
}
