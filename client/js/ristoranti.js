// ristoranti.js - Gestione visualizzazione ristoranti per clienti

let tuttiRistoranti = []; // array completo dei ristoranti
let ristornatiFiltrati = []; // array filtrato dalla ricerca

// carica tutti i ristoranti all'avvio
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Pagina ristoranti caricata');
    
    // controlla autenticazione - solo clienti loggati
    const user = await requireAuth(CONFIG.ROLES.CLIENTE);
    if (!user) return; // se non autenticato, requireAuth fa redirect e ferma l'esecuzione
    
    await caricaRistoranti();
    
    // gestisci form di ricerca
    const formRicerca = document.querySelector('form');
    if (formRicerca) {
        formRicerca.addEventListener('submit', async (e) => {
            e.preventDefault();
            await effettuaRicerca();
        });
    }
});

//carica tutti i ristoranti dal server

async function caricaRistoranti() {
    try {
        showLoading(true);
        
        const result = await apiGet(CONFIG.ENDPOINTS.RESTAURANTS);
        console.log('📍 Risposta API ristoranti:', result);
        
        if (result.success && result.data && result.data.ristoranti) {
            tuttiRistoranti = result.data.ristoranti;
            ristornatiFiltrati = [...tuttiRistoranti];
            renderRistoranti(ristornatiFiltrati);
        } else {
            showToast('Errore nel caricamento dei ristoranti', 'error');
        }
    } catch (error) {
        console.error('Errore caricamento ristoranti:', error);
        showToast('Impossibile caricare i ristoranti. Riprova più tardi.', 'error');
    } finally {
        showLoading(false);
    }
}

//effettua la ricerca dei ristoranti in base ai filtri

async function effettuaRicerca() {
    const cercaLuogo = document.getElementById('cercaLuogo')?.value.trim().toLowerCase() || '';
    const cercaNome = document.getElementById('cercaNome')?.value.trim().toLowerCase() || '';
    
    // filtra i ristoranti localmente
    ristornatiFiltrati = tuttiRistoranti.filter(rist => {
        const matchLuogo = !cercaLuogo || 
            (rist.indirizzo && rist.indirizzo.toLowerCase().includes(cercaLuogo)) ||
            (rist.citta && rist.citta.toLowerCase().includes(cercaLuogo));
        
        const matchNome = !cercaNome || 
            (rist.nome && rist.nome.toLowerCase().includes(cercaNome));
        
        return matchLuogo && matchNome;
    });
    
    renderRistoranti(ristornatiFiltrati);
    
    // mostra messaggio se nessun risultato
    if (ristornatiFiltrati.length === 0) {
        const container = document.getElementById('ristorantiContainer');
        container.innerHTML = `
            <div class="alert alert-warning text-center">
                <h4>🔍 Nessun ristorante trovato</h4>
                <p>Prova a modificare i criteri di ricerca.</p>
            </div>
        `;
    }
}

// renderizza le card dei ristoranti
 
function renderRistoranti(ristoranti) {
    const container = document.getElementById('ristorantiContainer');
    
    if (!container) {
        console.error('Container ristoranti non trovato');
        return;
    }
    
    if (!ristoranti || ristoranti.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info text-center">
                <h4>📍 Nessun ristorante disponibile</h4>
                <p>Al momento non ci sono ristoranti nella tua zona.</p>
            </div>
        `;
        return;
    }
    
    //crea la griglia con le card
    container.innerHTML = `
        <div class="row g-4">
            ${ristoranti.map(ristorante => creaCardRistorante(ristorante)).join('')}
        </div>
    `;
    
    //aggiungi event listener ai bottoni "Vedi Menu"
    ristoranti.forEach(ristorante => {
        const btn = document.getElementById(`btn-menu-${ristorante.id}`);
        if (btn) {
            btn.addEventListener('click', () => vaiAlMenu(ristorante.id));
        }
    });
}

//crea l'HTML della card per un ristorante, con gestione dei dati mancanti e sicurezza contro XSS
function creaCardRistorante(ristorante) {
    const immagine = ristorante.immagine || '../img/ristorante-placeholder.jpg';
    const nome = escapeHtml(ristorante.nome || 'Ristorante');
    const indirizzo = escapeHtml(ristorante.indirizzo || 'Indirizzo non disponibile');
    const telefono = escapeHtml(ristorante.telefono || 'N/A');
    const descrizione = escapeHtml(ristorante.descrizione || 'Nessuna descrizione disponibile');
    
    return `
        <div class="col-md-4">
            <div class="card h-100 shadow-sm hover-card">
                <img src="${immagine}" class="card-img-top" alt="${nome}" style="height: 200px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-primary">${nome}</h5>
                    <p class="card-text text-muted mb-2">
                        <small>📍 ${indirizzo}</small>
                    </p>
                    <p class="card-text text-muted mb-2">
                        <small>📞 ${telefono}</small>
                    </p>
                    <p class="card-text flex-grow-1">${descrizione}</p>
                    <button 
                        id="btn-menu-${ristorante.id}" 
                        class="btn btn-primary w-100 mt-2">
                        🍽️ Vedi Menu
                    </button>
                </div>
            </div>
        </div>
    `;
}

// funzione per reindirizzare alla pagina del menu del ristorante selezionato, passando l'id come parametro

function vaiAlMenu(ristoranteId) {
    // reindirizza alla pagina menu.html passando l'ID del ristorante come parametro
    window.location.href = `menu.html?restaurantId=${ristoranteId}`;
}
