/**
 * dashboard.js
 * gestisce la dashboard del ristorante con ordini recenti e statistiche minimali
 * funzionalità:
 * - visualizza gli ultimi 4 ordini con dettagli (cliente, piatti, totale, stato)
 * - permette di cambiare lo stato degli ordini (ordinato -> in preparazione -> pronto -> in consegna -> consegnato)
 * - mostra statistiche base: numero ordini in corso, piatti più venduti, incassi di oggi e del mese
 */

// numero massimo di ordini da mostrare nella tabella "Ordini Recenti"
const MAX_ORDINI_RECENTI = 4;

//carica gli ordini recenti e le statistiche
async function caricaOrdiniRecenti() {
    try {
        // verifica utente loggato
        const user = await requireAuth(CONFIG.ROLES.RISTORANTE);
        if (!user) return;
        
        console.log('Utente loggato:', user);
        
        // chiamata all'API per ottenere gli ordini del ristorante
        const response = await apiGet(CONFIG.ENDPOINTS.ORDERS_RESTAURANT);
        
        console.log('Risposta API ordini completa:', response);
        
        if (!response.success) {
            console.error('Errore caricamento ordini:', response);
            mostraMessaggioErrore('Impossibile caricare gli ordini');
            return;
        }

        // la risposta può avere gli ordini in response.ordini O in response.data.ordini
        // per compatibilità con diverse versioni dell'API, cerco in entrambi i posti
        const ordini = response.ordini || response.data?.ordini || [];
        console.log('Ordini trovati:', ordini.length);
        console.log('Primi ordini:', ordini.slice(0, 2));
        
        // mostra gli ultimi ordini (i più recenti sono già ordinati per createdAt desc dall'API )
        const ordiniRecenti = ordini.slice(0, MAX_ORDINI_RECENTI);

        console.log('Ordini da mostrare:', ordiniRecenti.length);
        renderTabellaOrdini(ordiniRecenti);
        
        // aggiorna le statistiche con tutti gli ordini
        aggiornaStatistiche(ordini);
        
    } catch (error) {
        console.error('Errore durante il caricamento degli ordini:', error);
        mostraMessaggioErrore('Errore di connessione al server');
    }
}

//renderizza la tabella degli ordini recenti
function renderTabellaOrdini(ordini) {
    const tbody = document.querySelector('#tabellaOrdiniRecenti tbody');
    
    if (!tbody) {
        console.error('Elemento tbody non trovato');
        return;
    }

    // se non ci sono ordini, mostra messaggio
    if (!ordini || ordini.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    Nessun ordine recente da visualizzare
                </td>
            </tr>
        `;
        return;
    }

    // genera le righe della tabella
    tbody.innerHTML = ordini.map(ordine => {
        const orderId = ordine._id ? `#${ordine._id.slice(-6)}` : 'N/D';
        
        // i dati del cliente sono nell'oggetto cliente
        const nomeCliente = ordine.cliente?.nome || 'N/D';
        const cognomeCliente = ordine.cliente?.cognome || '';
        
        const totale = ordine.totale ? `€${parseFloat(ordine.totale).toFixed(2)}` : '€0.00';
        
        // estrae i nomi dei piatti
        const piattiNomi = ordine.piatti && ordine.piatti.length > 0
            ? ordine.piatti.map(p => p.nome || p.strMeal || 'Piatto').join(', ')
            : 'Nessun piatto';
        
        // badge dello stato
        const badgeStato = getBadgeStato(ordine.stato);
        
        // bottone azione basato sullo stato
        const btnAzione = getBottoneAzione(ordine);

        return `
            <tr>
                <td>${escapeHtml(orderId)}</td>
                <td>${escapeHtml(nomeCliente)} ${escapeHtml(cognomeCliente)}</td>
                <td>${totale}</td>
                <td class="text-truncate" style="max-width: 200px;" title="${escapeHtml(piattiNomi)}">
                    ${escapeHtml(piattiNomi)}
                </td>
                <td>${badgeStato}</td>
                <td>${btnAzione}</td>
            </tr>
        `;
    }).join('');

    // aggiungi event listener ai bottoni cioeè quelli che cambiano stato, dopo aver renderizzato la tabella
    aggiungiEventListenerBottoni();
}

//restituisce il badge HTML per lo stato dell'ordine
function getBadgeStato(stato) {
    const mappingStati = {
        [CONFIG.ORDER_STATES.ORDINATO]: { classe: 'bg-primary', testo: 'Ordinato' },
        [CONFIG.ORDER_STATES.IN_PREPARAZIONE]: { classe: 'bg-warning', testo: 'In preparazione' },
        [CONFIG.ORDER_STATES.PRONTO]: { classe: 'bg-info', testo: 'Pronto' },
        [CONFIG.ORDER_STATES.IN_CONSEGNA]: { classe: 'bg-secondary', testo: 'In consegna' },
        [CONFIG.ORDER_STATES.CONSEGNATO]: { classe: 'bg-success', testo: 'Consegnato' },
        [CONFIG.ORDER_STATES.ANNULLATO]: { classe: 'bg-danger', testo: 'Annullato' }
    };

    const statoInfo = mappingStati[stato?.toLowerCase()] || { classe: 'bg-secondary', testo: stato || 'N/D' };
    return `<span class="badge ${statoInfo.classe}">${statoInfo.testo}</span>`;
}

//restituisce il bottone azione appropriato per l'ordine

function getBottoneAzione(ordine) {
    const orderId = ordine._id;
    const stato = ordine.stato?.toLowerCase();
    const tipoOrdine = ordine.tipoOrdine || 'ritiro';

    switch (stato) {
        case CONFIG.ORDER_STATES.ORDINATO:
            return `<button class="btn btn-warning btn-sm" onclick="cambiaStatoOrdine('${orderId}', '${CONFIG.ORDER_STATES.IN_PREPARAZIONE}')">
                        Inizia preparazione
                    </button>`;
        
        case CONFIG.ORDER_STATES.IN_PREPARAZIONE:
            return `<button class="btn btn-info btn-sm" onclick="cambiaStatoOrdine('${orderId}', '${CONFIG.ORDER_STATES.PRONTO}')">
                        Segna come pronto
                    </button>`;
        
        case CONFIG.ORDER_STATES.PRONTO:
            // se è ritiro, il cliente segna come consegnato, quindi qui da lato ristorante non mostriamo il bottone, ma solo un messaggio per aspettare il cliente che ritira e conferma
            // se è domicilio, il ristorante può metterlo "in consegna" col bottone ma è una funzionalita che non implemento ora
            if (tipoOrdine === 'domicilio') {
                return `<button class="btn btn-secondary btn-sm" onclick="cambiaStatoOrdine('${orderId}', '${CONFIG.ORDER_STATES.IN_CONSEGNA}')">
                            Metti in consegna
                        </button>`;
            } else {
                return `<span class="text-muted small">In attesa del cliente</span>`;
            }
        
        case CONFIG.ORDER_STATES.IN_CONSEGNA:
            return `<span class="text-muted small">In consegna...</span>`;
        
        case CONFIG.ORDER_STATES.CONSEGNATO:
            return `<span class="text-success small">✓ Completato</span>`;
        
        case CONFIG.ORDER_STATES.ANNULLATO:
            return `<span class="text-danger small">✗ Annullato</span>`;
        
        default:
            return `<span class="text-muted small">-</span>`;
    }
}

//ambia lo stato di un ordine
 async function cambiaStatoOrdine(orderId, nuovoStato) {
    try {
        // se lo stato è "in preparazione", mostra il modal per il tempo di attesa
        if (nuovoStato === CONFIG.ORDER_STATES.IN_PREPARAZIONE) {
            // salva l'ID dell'ordine in una variabile globale per usarlo nel modal
            // window è un oggetto globale che rappresenta la finestra del browser, e posso usarlo
            // per memorizzare dati temporanei come l'ID dell'ordine selezionato
            window.ordineIdDashboard = orderId;
            
            // mostra il modal
            const modalElement = document.getElementById('modalTempoAttesa');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            } else {
                console.error('Modal tempo attesa non trovato');
                alert('Errore: Modal non disponibile');
            }
            return;
        }
        
        // per altri stati, chiedi conferma normale
        const conferma = confirm(`Vuoi cambiare lo stato dell'ordine in "${nuovoStato}"?`);
        if (!conferma) return;

        console.log('Cambio stato ordine:', orderId, 'a', nuovoStato);

        const response = await apiPatch(CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', orderId), {
            stato: nuovoStato
        });

        console.log('Risposta cambio stato:', response);

        if (response.success) {
            alert(' Stato ordine aggiornato con successo!');
            // Ricarica gli ordini
            await caricaOrdiniRecenti();
        } else {
            const errorMsg = response.error || response.message || 'Errore sconosciuto';
            console.error('Errore dal server:', errorMsg);
            alert('Errore durante l\'aggiornamento: ' + errorMsg);
        }
    } catch (error) {
        console.error('Errore cambio stato:', error);
        alert('Errore di connessione al server');
    }
}

// conferma il tempo di attesa e imposta l'ordine in preparazione
 // Chiamata dal bottone del modal
 
async function confermaTempoAttesa() {
    try {
        const minutiInput = document.getElementById('minutiAttesa');
        const minuti = parseInt(minutiInput.value);
        
        // validazione
        if (isNaN(minuti) || minuti < 5 || minuti > 120) {
            alert('Tempo non valido! Deve essere tra 5 e 120 minuti.');
            return;
        }
        
        const orderId = window.ordineIdDashboard;
        if (!orderId) {
            alert('Errore: ID ordine non trovato');
            return;
        }
        
        console.log('Conferma tempo attesa:', orderId, minuti, 'minuti');
        
        // chiudi il modal
        const modalElement = document.getElementById('modalTempoAttesa');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // invia la richiesta
        const response = await apiPatch(CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', orderId), {
            stato: CONFIG.ORDER_STATES.IN_PREPARAZIONE,
            tempoAttesa: minuti
        });
        
        console.log('Risposta conferma tempo:', response);
        
        if (response.success) {
            alert(`Ordine in preparazione - Tempo stimato: ${minuti} minuti`);
            // ricarica gli ordini
            await caricaOrdiniRecenti();
            
            // resetta il campo per il prossimo utilizzo
            minutiInput.value = 30;
        } else {
            const errorMsg = response.error || response.message || 'Errore sconosciuto';
            console.error('Errore dal server:', errorMsg);
            alert('Errore durante l\'aggiornamento: ' + errorMsg);
        }
    } catch (error) {
        console.error('Errore conferma tempo attesa:', error);
        alert('Errore di connessione al server');
    }
}

// aggiunge event listener ai bottoni della tabella

function aggiungiEventListenerBottoni() {
    // i bottoni usano onclick inline, funzione opzionale
    // può essere usata per aggiungere altri listener se necessario
}

//mostra un messaggio di errore nella tabella ordini recenti
function mostraMessaggioErrore(messaggio) {
    const tbody = document.querySelector('#tabellaOrdiniRecenti tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle"></i> ${escapeHtml(messaggio)}
                </td>
            </tr>
        `;
    }
}

/**
 * Funzione di escape HTML per prevenire XSS
 * @param {string} str - Stringa da rendere sicura
 * @returns {string} Stringa escaped
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

//aggiorna stats della tabella ordini recenti e della dashboard

function aggiornaStatistiche(ordini) {
    // N. ORDINI IN CORSO (non consegnati, non annullati)
    const ordiniInCorso = ordini.filter(o => 
        o.stato !== CONFIG.ORDER_STATES.CONSEGNATO && o.stato !== CONFIG.ORDER_STATES.ANNULLATO
    ).length;
    document.getElementById('ordiniInCorso').textContent = ordiniInCorso;
    
    // PIATTI PIU VENDUTI (solo ordini consegnati)
    const piattiVenduti = {};
    ordini
        .filter(o => o.stato === CONFIG.ORDER_STATES.CONSEGNATO)
        .forEach(ordine => {
            ordine.piatti?.forEach(piatto => {
                const nome = piatto.nome || piatto.strMeal || 'Piatto senza nome';
                if (!piattiVenduti[nome]) {
                    piattiVenduti[nome] = 0;
                }
                piattiVenduti[nome] += piatto.quantita || 1;
            });
        });
    
    // ordina per quantità e prendi i primi 3
    const topPiatti = Object.entries(piattiVenduti)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    const listaPiatti = document.getElementById('piattiPiuVenduti');
    if (topPiatti.length > 0) {
        listaPiatti.innerHTML = topPiatti
            .map(([nome, quantita]) => `<li>${escapeHtml(nome)} (${quantita})</li>`)
            .join('');
    } else {
        listaPiatti.innerHTML = '<li class="text-muted">Nessun dato disponibile</li>';
    }
    
    //INCASSSI (solo ordini consegnati)
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    
    let incassiOggi = 0;
    let incassiMese = 0;
    
    ordini
        .filter(o => o.stato === CONFIG.ORDER_STATES.CONSEGNATO)
        .forEach(ordine => {
            const totale = parseFloat(ordine.totale) || 0;
            const dataOrdine = new Date(ordine.createdAt);
            
            // incassi mese 
            if (dataOrdine >= primoGiornoMese) {
                incassiMese += totale;
            }
            
            // incassi di oggi
            if (dataOrdine >= oggi) {
                incassiOggi += totale;
            }
        });
    
    document.getElementById('incassiOggi').textContent = `€ ${incassiOggi.toFixed(2)}`;
    document.getElementById('incassiMese').textContent = `€ ${incassiMese.toFixed(2)}`;
}

// ==================== INIZIALIZZAZIONE..... ==================

// carica gli ordini quando la pagina è pronta
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard caricata, inizializzazione...');
    
    // carica gli ordini recenti
    await caricaOrdiniRecenti();
    
    // auto-refresh ogni 30 secondi
    setInterval(caricaOrdiniRecenti, 30000);
    
    console.log('Dashboard inizializzata con successo');
});
