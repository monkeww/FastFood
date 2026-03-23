// cart.js - gestione carrello lato cliente

// ===== VARIABILI CARRELLO LOCALE =====
let carrelloLocale = {}; // { menuItemId: quantita }
let ristoranteIdCorrente = null; // ID del ristorante dal quale si sta ordinando
let carrelloCorrente = null; // carrello completo dal server (per la pagina carrello.html)
let ristoranteCorrente = null; // dettagli del ristorante (per la pagina carrello.html)

//NB: non si puo ordinare da piu ristorani nello stesso ordine/carrello

// ===== FUNZIONI CARRELLO =====


//  iposta l'ID del ristorante corrente
 
function setRistoranteId(ristoranteId) {
    ristoranteIdCorrente = ristoranteId;
}


//  ottiene l'ID del ristorante dall'URL
// ritorna {string|null} ID del ristorante
 
function getRistoranteIdFromURL() {
    return getUrlParameter('restaurantId');
}


//  sincronizza il carrello locale con quello del server

async function sincronizzaCarrelloLocale() {
    try {
        const result = await apiGet(CONFIG.ENDPOINTS.CART);
        
        if (result.success && result.data && result.data.cart) {
            // costruisce l'oggetto carrelloLocale dal carrello del server e usa l'_id del cart item come chiave
            
            carrelloLocale = {};
            result.data.cart.items.forEach(item => {
                // usa menuItemId se presente, altrimenti item._id
                const chiave = item.menuItemId || item._id;
                carrelloLocale[chiave] = item.quantita;
            });
            
            aggiornaBadgeCarrello();
            aggiornaControlliQuantita();
        }
    } catch (error) {
        console.error('Errore sincronizzazione carrello:', error);
    }
}

//aggiorna il badge del mini carrello popup con il numero totale di articoli
//e a ggiunge un'animazione pulse quando il numero cambia
 
function aggiornaBadgeCarrello() {
    const badge = document.getElementById('carrelloBadge');
    if (!badge) return;
    
    //carrellolocale è un oggetto { menuItemId: quantita }, somma tutte le quantità per ottenere il totale degli articoli
    const totaleArticoli = Object.values(carrelloLocale).reduce((sum, qty) => sum + qty, 0);
    badge.textContent = totaleArticoli;
    
    // mostra/nasconde il bottone "Ordina ora" in base ai contenuti del carrello
    const ordinaOraBtn = document.getElementById('ordinaOraBtn');
    if (ordinaOraBtn) {
        if (totaleArticoli > 0) {
            ordinaOraBtn.style.display = 'inline-block';
        } else {
            ordinaOraBtn.style.display = 'none';
        }
    }
    
    // Animazione pulse quando cambia
    const miniCarrello = document.getElementById('miniCarrello');
    if (miniCarrello && totaleArticoli > 0) {
        miniCarrello.classList.remove('pulse');
        void miniCarrello.offsetWidth; // trigger reflow, necessario per riapplicare l'animazione
        miniCarrello.classList.add('pulse');
        setTimeout(() => miniCarrello.classList.remove('pulse'), 600);
    }
}


 // genera i controlli di quantità per un piatto specifico

function getQuantityControls(piattoId, nomePiatto, prezzo) {
    const quantita = carrelloLocale[piattoId] || 0;
    
    if (quantita === 0) {
        // mostra solo il bottone "aggiungi"
        return `
            <button class="btn btn-primary" 
                    onclick="modificaQuantitaCarrello('${piattoId}', '${escapeHtml(nomePiatto).replace(/'/g, "\\'")}', ${prezzo}, 1)">
                Aggiungi
            </button>
        `;
    } else {
        // mostra i controlli + / - / cestino
        return `
            <div class="quantity-controls">
            <button class="btn-quantity btn-remove" 
                        onclick="rimuoviDalCarrello('${piattoId}', '${escapeHtml(nomePiatto).replace(/'/g, "\\'")}', ${prezzo})"
                        title="Rimuovi dal carrello">
                    🗑️
                </button>
                <button class="btn-quantity" 
                        onclick="modificaQuantitaCarrello('${piattoId}', '${escapeHtml(nomePiatto).replace(/'/g, "\\'")}', ${prezzo}, ${quantita - 1})"
                        title="Rimuovi uno">
                    −
                </button>
                <span class="quantity-display">${quantita}</span>
                <button class="btn-quantity" 
                        onclick="modificaQuantitaCarrello('${piattoId}', '${escapeHtml(nomePiatto).replace(/'/g, "\\'")}', ${prezzo}, ${quantita + 1})"
                        title="Aggiungi uno">
                    +
                </button>
                
            </div>
        `;
    }
}

//aggiorna i controlli di quantità per tutti i piatti nella pagina in base al carrelloLocale
function aggiornaControlliQuantita() {
    // aggiorna tutti i controlli di quantità nella pagina
    document.querySelectorAll('[id^="controls-"]').forEach(controlsDiv => {
        const piattoId = controlsDiv.id.replace('controls-', '');
        const card = controlsDiv.closest('.card');
        const nomePiatto = card.querySelector('.card-title')?.textContent || '';
        const prezzoText = card.querySelector('.prezzo-piatto')?.textContent || '0';
        const prezzo = parseFloat(prezzoText.replace('€', '').replace(',', '.').trim());
        
        // aggiorna i controlli
        controlsDiv.innerHTML = getQuantityControls(piattoId, nomePiatto, prezzo);
        
        // aggiungi/rimuovi classe e tick in base alla presenza nel carrello
        const quantita = carrelloLocale[piattoId] || 0;
        
        if (quantita > 0) {
            // aggiungi bordo arancione
            card.classList.add('in-carrello');
            
            // aggiungi tick se non esiste già
            if (!card.querySelector('.carrello-tick')) {
                const tick = document.createElement('div');
                tick.className = 'carrello-tick';
                tick.innerHTML = '✓';
                card.appendChild(tick);
            }
        } else {
            // rimuovi bordo arancione
            card.classList.remove('in-carrello');
            
            // rimuovi tick se esiste
            const tick = card.querySelector('.carrello-tick');
            if (tick) {
                tick.remove();
            }
        }
    });
}


//modfica la quantita di un piatto ...aggiungendi i rmuovendo 
async function modificaQuantitaCarrello(menuItemId, nomePiatto, prezzo, nuovaQuantita) {
    if (nuovaQuantita < 0) return;
    
    // ottiene l'ID del ristorante
    const ristoranteId = ristoranteIdCorrente || getRistoranteIdFromURL();
    
    if (!ristoranteId) {
        showToast(' Errore: ID ristorante non trovato', 'error');
        console.error('ristoranteIdCorrente:', ristoranteIdCorrente);
        console.error('URL restaurantId:', getRistoranteIdFromURL());
        return;
    }
    
    try {
        let result;
        const quantitaCorrente = carrelloLocale[menuItemId] || 0;
        
        if (nuovaQuantita === 0) {
            // rimuovi dal carrello usando menuItemId come identificatore
            result = await apiDelete(CONFIG.ENDPOINTS.CART_REMOVE.replace('{menuItemId}', menuItemId));
            
            if (result.success) {
                delete carrelloLocale[menuItemId];
                //showToast(`🗑️ ${nomePiatto} rimosso dal carrello`, 'info');
            }
        } else if (nuovaQuantita < quantitaCorrente) {
            // riduci la quantità: rimuove la differenza
            const daRimuovere = quantitaCorrente - nuovaQuantita;
            
            //se la nuova quantità è 0 rimuovi completamente, altrimenti aggiungi con quantità negativa per decrementare
            if (nuovaQuantita === 0) {
                result = await apiDelete(CONFIG.ENDPOINTS.CART_REMOVE.replace('{menuItemId}', menuItemId));
                if (result.success) {
                    delete carrelloLocale[menuItemId];
                    showToast(`🗑️ ${nomePiatto} rimosso dal carrello`, 'info');
                }
            } else {
                //  quantità negativa per decrementare
                const payload = {
                    ristoranteId: ristoranteId,
                    menuItemId: menuItemId,
                    strMeal: nomePiatto,
                    prezzo: prezzo,
                    quantita: -daRimuovere,
                    strCategory: '',
                    strMealThumb: '',
                    ingredients: []
                };
                
                result = await apiPost(CONFIG.ENDPOINTS.CART_ADD, payload);
                
                if (result.success) {
                    carrelloLocale[menuItemId] = nuovaQuantita;
                    //showToast(`✅ Quantità aggiornata: ${nuovaQuantita}`, 'success');
                }
            }
        } else {
            // aumenta la quantità
            const daAggiungere = nuovaQuantita - quantitaCorrente;
            
            // recupera i dati completi del piatto dal DOM
            const card = document.getElementById(`controls-${menuItemId}`)?.closest('.card');
            const ingredientsText = card?.querySelector('.card-text')?.textContent || '';
            const categoria = card?.querySelector('.colore-arancione')?.textContent || '';
            const immagine = card?.querySelector('.card-img-top')?.src || '';
            
            // prepara il payload per l'API
            const payload = {
                ristoranteId: ristoranteId,
                menuItemId: menuItemId,
                strMeal: nomePiatto,
                prezzo: prezzo,
                quantita: daAggiungere,
                strCategory: categoria,
                strMealThumb: immagine,
                //se vuoto da un array vuoto altrimenti ogni elmento sep da virgola è elemento dell'array, trim per rimuovere spazi inizio e fine
                ingredients: ingredientsText ? ingredientsText.split(',').map(i => i.trim()) : []
            };
            
            result = await apiPost(CONFIG.ENDPOINTS.CART_ADD, payload);
            
            if (result.success) {
                carrelloLocale[menuItemId] = nuovaQuantita;
                
                if (quantitaCorrente === 0) {
                    //showToast(`✅ ${nomePiatto} aggiunto al carrello!`, 'success');
                } else {
                    //showToast(`✅ Quantità aggiornata: ${nuovaQuantita}`, 'success');
                }
            }
        }
        
        if (result.success) {
            aggiornaBadgeCarrello();
            aggiornaControlliQuantita();
            // se il server ha comunicato carrello vuoto (reset per cambio ristorante) azzera ristoranteIdCorrente
            const serverCart = result.cart || (result.data && result.data.cart);
            if (serverCart && Array.isArray(serverCart.items) && serverCart.items.length === 0) {
                ristoranteIdCorrente = null; // permetti ordine da nuovo ristorante senza reload
            }
        } else {
            showToast(` Errore: ${result.message || result.error || 'Operazione fallita'}`, 'error');
        }
    } catch (error) {
        console.error('Errore modifica carrello:', error);
        showToast(' Errore nella modifica del carrello', 'error');
    }
}

// rimuove completamente un piatto dal carrello, indipendentemente dalla quantità attuale, usando menuItemId come identificatore
async function rimuoviDalCarrello(menuItemId, nomePiatto, prezzo) {
    if (!confirm(`Vuoi rimuovere "${nomePiatto}" dal carrello?`)) {
        return;
    }
    
    await modificaQuantitaCarrello(menuItemId, nomePiatto, prezzo, 0);
}

//inizializza il carrello al caricamento della pagina, sincronizzando con il server e impostando l'ID del ristorante se presente nell'URL
async function inizializzaCarrello() {
    // se disponibile
    const ristoranteId = getRistoranteIdFromURL();
    if (ristoranteId) {
        setRistoranteId(ristoranteId);
    }
    
    await sincronizzaCarrelloLocale();
}


 // svuota completamente il carrello lato server e resetta stato locale
 
async function svuotaCarrello() {
    if (!confirm('Vuoi svuotare completamente il carrello?')) return;
    try {
        const result = await apiDelete(CONFIG.ENDPOINTS.CART_CLEAR);
        if (result.success) {
            carrelloLocale = {};
            ristoranteIdCorrente = null;
            aggiornaBadgeCarrello();
            aggiornaControlliQuantita();
            showToast(' Carrello svuotato. Puoi ordinare da un altro ristorante.', 'success');
        } else {
            showToast(` Errore svuotamento: ${result.message || result.error || 'Operazione fallita'}`, 'error');
        }
    } catch (err) {
        console.error('Errore svuotamento carrello:', err);
        showToast(' Errore svuotamento carrello', 'error');
    }
}

// espone funzioni globali se necessario
window.svuotaCarrello = svuotaCarrello;

// ===== FUNZIONI PAGINA CARRELLO.HTML =====

/*
  caricaCarrello
  Carica il carrello dal server e renderizza la pagina carrello.
  Gestisce il caso di carrello vuoto e carica i dati del ristorante.
*/
async function caricaCarrello() {
    try {
        showLoading(true);
        const result = await apiGet(CONFIG.ENDPOINTS.CART);
        console.log('Carrello caricato:', result);
        
        if (result.success && result.data.cart) {
            carrelloCorrente = result.data.cart;
            
            if (carrelloCorrente.items.length === 0) {
                mostraCarrelloVuoto();
            } else {
                await caricaInfoRistorante();
                renderCarrello();
            }
        } else {
            mostraCarrelloVuoto();
        }
    } catch (error) {
        console.error('Errore caricamento carrello:', error);
        showToast('Errore nel caricamento del carrello', 'error');
        mostraCarrelloVuoto();
    } finally {
        showLoading(false);
    }
}

/*
  caricaInfoRistorante
  Carica i dettagli del ristorante dal server usando l'ID del carrello.
*/
async function caricaInfoRistorante() {
    if (!carrelloCorrente.ristoranteId) return;
    
    const ristoranteId = carrelloCorrente.ristoranteId.toString();
    if (ristoranteId.length !== 24) {
        console.error('❌ ID ristorante non valido:', ristoranteId, '- Lunghezza:', ristoranteId.length);
        showToast('⚠️ Carrello corrotto. Svuotamento in corso...', 'warning');
        await svuotaCarrello();
        mostraCarrelloVuoto();
        return;
    }
    
    try {
        const result = await apiGet(CONFIG.ENDPOINTS.RESTAURANTS_DETAIL.replace('{id}', ristoranteId));
        if (result.success && result.data) {
            ristoranteCorrente = result.data.ristorante;
        }
    } catch (error) {
        console.error('Errore caricamento ristorante:', error);
        showToast('⚠️ Errore caricamento ristorante. Svuotamento carrello...', 'error');
        await svuotaCarrello();
        mostraCarrelloVuoto();
    }
}

/*
  renderCarrello
  Renderizza la tabella degli items del carrello con prezzi, quantità e totale.
*/
function renderCarrello() {
    const container = document.getElementById('carelloItemsContainer');
    const totaleEl = document.getElementById('totaleOrdine');
    const ristoranteInfo = document.getElementById('ristoranteInfo');
    const carrelloVuoto = document.getElementById('carrelloVuoto');
    const checkoutCard = document.getElementById('checkoutCard');
    const continuaOrdinare = document.getElementById('continuaOrdinare');
    
    carrelloVuoto.style.display = 'none';
    checkoutCard.style.display = 'block';
    continuaOrdinare.style.display = 'block';
    
    if (carrelloCorrente.ristoranteId) {
        const tornaAlMenuLink = document.getElementById('tornaAlMenu');
        if (tornaAlMenuLink) {
            tornaAlMenuLink.href = `menu.html?restaurantId=${carrelloCorrente.ristoranteId}`;
        }
    }
    
    if (ristoranteCorrente) {
        ristoranteInfo.textContent = `Da: ${ristoranteCorrente.nomeRistorante}`;
    }
    
    let totale = 0;
    let html = '<div class="list-group">';
    
    carrelloCorrente.items.forEach(item => {
        const subtotale = item.prezzo * item.quantita;
        totale += subtotale;
        
        html += `
            <div class="list-group-item">
                <div class="row align-items-center">
                    <div class="col-md-2">
                        ${item.strMealThumb || item.immagine ? 
                            `<img src="${item.strMealThumb || item.immagine}" 
                                 class="img-fluid rounded" 
                                 alt="${escapeHtml(item.strMeal)}"
                                 style="max-height: 80px; object-fit: cover;"
                                 onerror="this.style.display='none';">` 
                            : 
                            `<div class="bg-secondary rounded d-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
                                <span style="font-size: 2rem;">🍽️</span>
                            </div>`
                        }
                    </div>
                    <div class="col-md-4">
                        <h6 class="mb-1">${escapeHtml(item.strMeal)}</h6>
                        ${item.strCategory ? `<small class="text-muted">${escapeHtml(item.strCategory)}</small>` : ''}
                    </div>
                    <div class="col-md-3">
                        <div class="quantity-controls">
                            <button class="btn-quantity btn-remove" 
                                    onclick="rimuoviItem('${item.menuItemId || item._id}')"
                                    title="Rimuovi">
                                🗑️
                            </button>
                            <button class="btn-quantity" 
                                    onclick="modificaQuantitaCarrello('${item.menuItemId || item._id}', '${escapeHtml(item.strMeal).replace(/'/g, "\\'")}', ${item.prezzo}, ${item.quantita - 1})"
                                    title="Rimuovi uno">
                                −
                            </button>
                            <span class="quantity-display">${item.quantita}</span>
                            <button class="btn-quantity" 
                                    onclick="modificaQuantitaCarrello('${item.menuItemId || item._id}', '${escapeHtml(item.strMeal).replace(/'/g, "\\'")}', ${item.prezzo}, ${item.quantita + 1})"
                                    title="Aggiungi uno">
                                +
                            </button>
                        </div>
                    </div>
                    <div class="col-md-3 text-end">
                        <strong class="colore-arancione">€ ${subtotale.toFixed(2)}</strong>
                        <br>
                        <small class="text-muted">€ ${item.prezzo.toFixed(2)} cad.</small>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    totaleEl.textContent = `€ ${totale.toFixed(2)}`;
}

/*
  mostraCarrelloVuoto
  Nasconde i controlli di checkout e mostra il messaggio di carrello vuoto.
*/
function mostraCarrelloVuoto() {
    document.getElementById('carrelloVuoto').style.display = 'block';
    document.getElementById('carelloItemsContainer').innerHTML = '';
    document.getElementById('checkoutCard').style.display = 'none';
    document.getElementById('continuaOrdinare').style.display = 'none';
}

/*
  rimuoviItem
  Rimuove completamente un item dal carrello con conferma.
*/
async function rimuoviItem(menuItemId) {
    if (!confirm('Vuoi rimuovere questo piatto dal carrello?')) return;
    
    try {
        showLoading(true);
        const result = await apiDelete(CONFIG.ENDPOINTS.CART_REMOVE.replace('{menuItemId}', menuItemId));
        
        if (result.success) {
            showToast('Rimosso dal carrello', 'success');
            await caricaCarrello();
        } else {
            showToast(result.message || 'Errore rimozione', 'error');
        }
    } catch (error) {
        console.error('Errore rimozione:', error);
        showToast('Errore nella rimozione', 'error');
    } finally {
        showLoading(false);
    }
}

/*
  mostraCampiPagamento
  Mostra/nasconde i campi di pagamento dinamicamente in base al metodo selezionato.
*/
function mostraCampiPagamento() {
    const tipo = document.querySelector('input[name="metodoPagamento"]:checked').value;
    document.getElementById('campiCarta').style.display = tipo === 'carta' ? 'block' : 'none';
    document.getElementById('campiPaypal').style.display = tipo === 'paypal' ? 'block' : 'none';
}

/*
  procediAlPagamento
  Valida i dati di pagamento e crea l'ordine sul server.
*/
async function procediAlPagamento() {
    const tipo = document.querySelector('input[name="metodoPagamento"]:checked').value;
    const tipoOrdine = document.querySelector('input[name="tipoOrdine"]:checked').value;
    const metodoPagamento = { tipo };
    
    if (tipo === 'carta') {
        const numeroMascherato = document.getElementById('numeroCarta').value;
        const circuito = document.getElementById('circuitoCarta').value;
        
        if (!numeroMascherato || numeroMascherato.length !== 4) {
            showToast('Inserisci le ultime 4 cifre della carta', 'error');
            return;
        }
        
        metodoPagamento.circuito = circuito;
        metodoPagamento.numeroMascherato = '****' + numeroMascherato;
    } else if (tipo === 'paypal') {
        const emailPaypal = document.getElementById('emailPaypal').value;
        
        if (!emailPaypal || !emailPaypal.includes('@')) {
            showToast('Email PayPal non valida', 'error');
            return;
        }
        
        metodoPagamento.emailPaypal = emailPaypal;
    }
    
    try {
        showLoading(true);
        console.log('📤 Invio richiesta creazione ordine:', { metodoPagamento, tipoOrdine });
        const result = await apiPost(CONFIG.ENDPOINTS.ORDERS_CREATE, { metodoPagamento, tipoOrdine });
        console.log('📥 Risposta creazione ordine:', result);
        
        if (result.success) {
            showToast('✅ Ordine creato con successo!', 'success');
            setTimeout(() => {
                window.location.href = 'ordini.html';
            }, 2000);
        } else {
            console.error('❌ Errore dal server:', result);
            showToast(result.message || 'Errore creazione ordine', 'error');
        }
    } catch (error) {
        console.error('❌ Errore creazione ordine:', error);
        console.error('Stack trace:', error.stack);
        showToast('Errore nella creazione dell\'ordine. Controlla la console.', 'error');
    } finally {
        showLoading(false);
    }
}
