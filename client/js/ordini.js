// Gestione ordini - Cliente + Ristorante

// ===== FUNZIONI UTILITY =====

// Calcola tempo rimanente fino alla consegna stimata
function calcolaTempoRimanente(ordine) {
    // se l'ordine è già pronto, consegnato, annullato o non ha timer, mostra lo stato
    if (ordine.stato === CONFIG.ORDER_STATES.PRONTO) {
        return '<span class="badge bg-success">✅ Pronto!</span>';
    }
    
    if (ordine.stato === CONFIG.ORDER_STATES.CONSEGNATO) {
        return '<span class="badge bg-secondary">✓ Consegnato</span>';
    }
    
    if (ordine.stato === CONFIG.ORDER_STATES.ANNULLATO) {
        return '<span class="badge bg-danger">❌ Annullato</span>';
    }
    
    if (!ordine.tempoConsegnaStimato || ordine.stato === CONFIG.ORDER_STATES.ORDINATO) {
        return '-';
    }
    
    const ora = new Date();
    const tempoConsegna = new Date(ordine.tempoConsegnaStimato);
    const differenzaMs = tempoConsegna - ora;
    
    // se il tempo è scaduto
    if (differenzaMs <= 0) {
        if (ordine.stato === CONFIG.ORDER_STATES.IN_PREPARAZIONE) {
            return '<span class="badge bg-success">⏰ Pronto!</span>';
        }
        return '<span class="badge bg-secondary">Scaduto</span>';
    }
    
    // calcola minuti rimanenti
    const minutiRimanenti = Math.ceil(differenzaMs / (1000 * 60));
    
    if (minutiRimanenti < 5) {
        return `<span class="badge bg-warning">⏱️ ${minutiRimanenti} min</span>`;
    } else if (minutiRimanenti < 15) {
        return `<span class="badge bg-info">⏱️ ${minutiRimanenti} min</span>`;
    } else {
        return `<span class="badge bg-secondary">⏱️ ${minutiRimanenti} min</span>`;
    }
}

// ===== FUNZIONI CLIENTE =====

async function caricaOrdiniCliente() {
    showLoading(true);
    
    const result = await apiGet(CONFIG.ENDPOINTS.ORDERS_MINE);
    
    showLoading(false);
    
    if (result.success) {
        renderOrdiniClienteSeparati(result.data.ordini);
    } else {
        showToast('Errore nel caricamento ordini', 'error');
    }
}

function renderOrdiniClienteSeparati(ordini) {
    // dividi ordini in corso e completati
    const ordiniInCorso = ordini.filter(o => 
        o.stato !== CONFIG.ORDER_STATES.CONSEGNATO && o.stato !== CONFIG.ORDER_STATES.ANNULLATO
    );
    const ordiniStorico = ordini.filter(o => 
        o.stato === CONFIG.ORDER_STATES.CONSEGNATO || o.stato === CONFIG.ORDER_STATES.ANNULLATO
    );
    
    // renderizza ordini in corso
    const containerInCorso = document.getElementById('ordini-in-corso');
    if (containerInCorso) {
        if (ordiniInCorso.length === 0) {
            containerInCorso.innerHTML = '<p class="text-center text-muted">Nessun ordine in corso</p>';
        } else {
            containerInCorso.innerHTML = renderTabellaOrdiniCliente(ordiniInCorso);
        }
    }
    
    // renderizza storico
    const containerStorico = document.getElementById('ordini-storico');
    if (containerStorico) {
        if (ordiniStorico.length === 0) {
            containerStorico.innerHTML = '<p class="text-center text-muted">Nessun ordine nello storico</p>';
        } else {
            containerStorico.innerHTML = renderTabellaOrdiniCliente(ordiniStorico);
        }
    }
}

function renderTabellaOrdiniCliente(ordini) {
    return `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>ID Ordine</th>
                        <th>Data</th>
                        <th>Ristorante</th>
                        <th>Piatti</th>
                        <th>Totale</th>
                        <th>Stato</th>
                        <th>Tempo Attesa</th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${ordini.map((ordine, index) => {
                        // crea lista piatti con quantità (a capo)
                        const listaPiatti = ordine.piatti
                            .map(p => `${escapeHtml(p.strMeal || p.nome || 'Piatto')} x${p.quantita}`)
                            .join('<br>');
                        
                        // calcola tempo rimanente
                        const tempoRimanente = calcolaTempoRimanente(ordine);
                        
                        return `
                        <tr>
                            <td><strong>#${ordine.orderId || (ordine._id ? ordine._id.slice(-6).toUpperCase() : 'N/D')}</strong></td>
                            <td>${formatDate(ordine.createdAt)}</td>
                            <td>${escapeHtml(ordine.nomeRistorante || 'N/D')}</td>
                            <td><small>${listaPiatti}</small></td>
                            <td>${formatPrice(ordine.totale)}</td>
                            <td>${getStatusBadge(ordine.stato)}</td>
                            <td>${tempoRimanente}</td>
                            <td>
                                <button class="btn btn-sm btn-primary mb-1" onclick="mostraDettaglioOrdine('${ordine._id}')">
                                    👁️ Dettagli
                                </button>
                                ${(ordine.stato === CONFIG.ORDER_STATES.PRONTO || ordine.stato === CONFIG.ORDER_STATES.IN_CONSEGNA) ? `
                                    <button class="btn btn-sm btn-success" onclick="confermaRicezione('${ordine._id}')">
                                        ✅ Conferma Ritiro
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function mostraDettaglioOrdine(ordineId) {
    // apri il modal
    const modal = new bootstrap.Modal(document.getElementById('modalDettaglioOrdine'));
    modal.show();
    
    // carica i dettagli dell'ordine
    const result = await apiGet(CONFIG.ENDPOINTS.ORDERS_DETAIL.replace('{id}', ordineId));
    
    const modalBody = document.getElementById('modalDettaglioOrdineBody');
    const modalFooter = document.getElementById('modalDettaglioOrdineFooter');
    
    if (!result.success) {
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <strong>Errore:</strong> ${result.message || 'Impossibile caricare i dettagli dell\'ordine'}
            </div>
        `;
        modalFooter.innerHTML = '';
        return;
    }
    
    const ordine = result.data?.ordine || result.ordine || result.data;
    
    console.log('📦 Dati ordine ricevuti:', ordine); // DEBUG
    
    // verifica che i dati siano completi
    if (!ordine || !ordine.piatti) {
        modalBody.innerHTML = `
            <div class="alert alert-warning">
                <strong>Attenzione:</strong> Dati ordine incompleti
                <pre>${JSON.stringify(result, null, 2)}</pre>
            </div>
        `;
        modalFooter.innerHTML = '';
        return;
    }
    
    // header con info ordine e ristorante
    modalBody.innerHTML = `
        <!-- Header Ordine -->
        <div class="row mb-3">
            <div class="col-md-6">
                <h6 class="text-muted">Ordine #${ordine.orderId || (ordine._id ? ordine._id.slice(-8).toUpperCase() : 'N/D')}</h6>
                <p class="mb-1"><strong>Data:</strong> ${formatDate(ordine.createdAt)}</p>
                <p class="mb-0"><strong>Stato:</strong> ${getStatusBadge(ordine.stato)}</p>
            </div>
            <div class="col-md-6 text-md-end">
                <h4 class="text-primary mb-0">${formatPrice(ordine.totale)}</h4>
                <p class="text-muted small">Totale ordine</p>
            </div>
        </div>
        
        <hr>
        
        <!-- Info Ristorante -->
        <div class="card mb-3 border-0 bg-light">
            <div class="card-body">
                <h6 class="card-title">🏪 Ristorante</h6>
                <p class="mb-1"><strong>${escapeHtml(ordine.ristorante?.nome || 'N/D')}</strong></p>
                ${ordine.ristorante?.telefono ? `<p class="mb-1 small">📞 ${escapeHtml(ordine.ristorante.telefono)}</p>` : ''}
                ${ordine.ristorante?.indirizzo ? `<p class="mb-0 small">📍 ${escapeHtml(ordine.ristorante.indirizzo)}</p>` : ''}
            </div>
        </div>
        
        <!-- Lista Piatti -->
        <h6 class="mb-3">🍽️ Piatti ordinati</h6>
        <div class="list-group mb-3">
            ${ordine.piatti.map(piatto => `
                <div class="list-group-item">
                    <div class="d-flex align-items-center">
                        ${piatto.immagine ? `
                            <img src="${piatto.immagine}" alt="${escapeHtml(piatto.strMeal || piatto.nome)}" 
                                 class="rounded me-3" 
                                 style="width: 60px; height: 60px; object-fit: cover;">
                        ` : ''}
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}</h6>
                            ${piatto.categoria ? `<small class="text-muted">${escapeHtml(piatto.categoria)}</small>` : ''}
                        </div>
                        <div class="text-end">
                            <p class="mb-0"><strong>x${piatto.quantita}</strong></p>
                            <p class="mb-0 text-muted small">${formatPrice(piatto.prezzo)} cad.</p>
                        </div>
                        <div class="text-end ms-3" style="min-width: 80px;">
                            <strong>${formatPrice(piatto.prezzo * piatto.quantita)}</strong>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Metodo Pagamento -->
        <div class="card border-0 bg-light mb-3">
            <div class="card-body">
                <h6 class="card-title">💳 Metodo di Pagamento</h6>
                ${renderMetodoPagamento(ordine.metodoPagamentoUsato)}
            </div>
        </div>
        
        <!-- Tipo Ordine -->
        <div class="card border-0 bg-light mb-3">
            <div class="card-body">
                <h6 class="card-title">${ordine.tipoOrdine === 'domicilio' ? '🚚' : '🏪'} Tipo Ordine</h6>
                <p class="mb-0"><strong>${ordine.tipoOrdine === 'domicilio' ? 'Consegna a domicilio' : 'Ritiro in loco'}</strong></p>
            </div>
        </div>
        
        <!-- Riepilogo Prezzi -->
        <div class="card border-primary">
            <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                    <span>Subtotale:</span>
                    <strong>${formatPrice(ordine.totale)}</strong>
                </div>
                <hr class="my-2">
                <div class="d-flex justify-content-between">
                    <strong>Totale:</strong>
                    <strong class="text-primary fs-5">${formatPrice(ordine.totale)}</strong>
                </div>
            </div>
        </div>
    `;
    
    // renderizza i pulsanti azione
    modalFooter.innerHTML = renderPulsantiAzioneOrdine(ordine);
}

function renderMetodoPagamento(metodo) {
    if (!metodo) {
        return '<p class="mb-0 text-muted">Metodo non specificato</p>';
    }
    
    let html = '';
    
    switch(metodo.tipo) {
        case 'contanti':
            html = '<p class="mb-0"> <strong>Contanti</strong> alla consegna</p>';
            break;
        case 'carta':
            html = `
                <p class="mb-1"> <strong>Carta di Credito/Debito</strong></p>
                ${metodo.circuito ? `<p class="mb-0 small text-muted">${escapeHtml(metodo.circuito)} terminante con ${escapeHtml(metodo.numeroMascherato || '****')}</p>` : ''}
            `;
            break;
        case 'paypal':
            html = `
                <p class="mb-1"> <strong>PayPal</strong></p>
                ${metodo.emailPaypal ? `<p class="mb-0 small text-muted">${escapeHtml(metodo.emailPaypal)}</p>` : ''}
            `;
            break;
        default:
            html = `<p class="mb-0">${escapeHtml(metodo.tipo)}</p>`;
    }
    
    return html;
}

function renderPulsantiAzioneOrdine(ordine) {
    let html = '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Chiudi</button>';
    
    // pulsante Riordina (sempre disponibile per ordini consegnati)
    if (ordine.stato === CONFIG.ORDER_STATES.CONSEGNATO) {
        html += `
            <button type="button" class="btn btn-success" onclick="riordinaPiatti('${ordine._id}')">
                🔄 Riordina
            </button>
        `;
    }
    
    // pulsante Annulla (solo se l'ordine è ancora ordinato o in preparazione)
    if (ordine.stato === CONFIG.ORDER_STATES.ORDINATO || ordine.stato === CONFIG.ORDER_STATES.IN_PREPARAZIONE) {
        html += `
            <button type="button" class="btn btn-danger" onclick="annullaOrdine('${ordine._id}')">
                ❌ Annulla Ordine
            </button>
        `;
    }
    
    return html;
}

async function riordinaPiatti(ordineId) {
    // carica i dettagli dell'ordine
    const result = await apiGet(CONFIG.ENDPOINTS.ORDERS_DETAIL.replace('{id}', ordineId));
    
    if (!result.success) {
        showToast('Errore nel caricamento dell\'ordine', 'error');
        return;
    }
    
    const ordine = result.data.ordine;
    
    // carica il menu del ristorante per trovare i piatti
    const menuResult = await apiGet(CONFIG.ENDPOINTS.MENU_RESTAURANT.replace('{id}', ordine.ristorante.id));
    
    if (!menuResult.success) {
        showToast('Errore nel caricamento del menu', 'error');
        return;
    }
    
    const menuItems = menuResult.data.menu;
    
    // aggiungi tutti i piatti al carrello
    let errori = 0;
    let piattiAggiunti = 0;
    
    for (const piatto of ordine.piatti) {
        console.log('Tentativo riordino piatto:', piatto);
        
        let menuItemId = piatto.menuItemId;
        let prezzoAttuale = piatto.prezzo;
        
        // se non ha menuItemId, cerca nel menu usando piattoComuneId o strMeal
        if (!menuItemId) {
            console.log('Cercando nel menu:', piatto.strMeal || piatto.nome);
            
            const menuItem = menuItems.find(m => 
                (piatto.piattoComuneId && m.piattoComuneId === piatto.piattoComuneId) ||
                (m.strMeal === piatto.strMeal)
            );
            
            if (menuItem) {
                menuItemId = menuItem._id;
                prezzoAttuale = menuItem.prezzo; //usa il prezzo attuale dal menu
                console.log('Trovato nel menu:', menuItemId, 'prezzo:', prezzoAttuale);
            } else {
                console.warn('Piatto non trovato nel menu:', piatto.strMeal || piatto.nome);
            }
        } else {
            //anche se ha menuItemId, prendi il prezzo aggiornato dal menu
            const menuItem = menuItems.find(m => m._id === menuItemId);
            if (menuItem) {
                prezzoAttuale = menuItem.prezzo;
            }
        }
        
        //prova ad aggiungere al carrello
        if (menuItemId && prezzoAttuale) {
            //cerca il menu item completo per avere tutti i dati
            const menuItem = menuItems.find(m => m._id === menuItemId);
            
            const datiCarrello = {
                ristoranteId: ordine.ristorante.id,
                menuItemId: menuItemId,
                piattoComuneId: piatto.piattoComuneId || (menuItem && menuItem.piattoComuneId) || null,
                strMeal: piatto.strMeal || (menuItem && menuItem.strMeal) || 'Piatto',
                strMealThumb: piatto.immagine || (menuItem && menuItem.strMealThumb) || '',
                strCategory: piatto.categoria || (menuItem && menuItem.strCategory) || '',
                ingredients: piatto.ingredients || (menuItem && menuItem.ingredients) || [],
                prezzo: prezzoAttuale,
                quantita: piatto.quantita
            };
            
            console.log('📦 Dati inviati al carrello:', datiCarrello);
            
            const addResult = await apiPost(CONFIG.ENDPOINTS.CART_ADD, datiCarrello);
            
            console.log('Risultato aggiunta al carrello:', addResult);
            
            if (addResult.success) {
                piattiAggiunti++;
            } else {
                console.error('Errore aggiunta piatto:', addResult.message || addResult.error);
                errori++;
            }
        } else {
            console.warn('Impossibile trovare menuItemId per:', piatto.strMeal || piatto.nome);
            errori++;
        }
    }
    
    //chiudi il modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalDettaglioOrdine'));
    modal.hide();
    
    if (piattiAggiunti > 0) {
        showToast(`${piattiAggiunti} piatti aggiunti al carrello!`, 'success');
        // Aggiorna il badge del carrello se esiste
        if (typeof aggiornaContatoreMiniCarrello === 'function') {
            aggiornaContatoreMiniCarrello();
        }
        //reindirizza al carrello
        setTimeout(() => {
            window.location.href = '/cliente/carrello.html';
        }, 1000);
    } else if (errori > 0) {
        showToast(`Impossibile riordinare: ${errori} piatti non più disponibili nel menu`, 'error');
    }
}

// cliente conferma ricezione ordine
async function confermaRicezione(ordineId) {
    if (!confirm('Confermi di aver ritirato/ricevuto l\'ordine?')) {
        return;
    }
    
    showLoading(true);
    
    const endpoint = CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', ordineId);
    const result = await apiPatch(endpoint, { stato: CONFIG.ORDER_STATES.CONSEGNATO });
    
    showLoading(false);
    
    if (result.success) {
        showToast('✅ Grazie! Ordine confermato come ricevuto', 'success');
        caricaOrdiniCliente(); //ricarica lista
    } else {
        showToast(result.message || result.error || 'Errore conferma ricezione', 'error');
    }
}

async function annullaOrdine(ordineId) {
    if (!confirm('Sei sicuro di voler annullare questo ordine?')) {
        return;
    }
    
    showLoading(true);
    
    const result = await apiPatch(CONFIG.ENDPOINTS.ORDERS_CANCEL.replace('{id}', ordineId));
    
    showLoading(false);
    
    if (result.success) {
        showToast('Ordine annullato con successo', 'success');
        
        //chiudi il modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalDettaglioOrdine'));
        modal.hide();
        
        //ricarica la lista ordini
        if (typeof caricaOrdiniCliente === 'function') {
            caricaOrdiniCliente();
        }
    } else {
        showToast(result.message || 'Errore nell\'annullamento dell\'ordine', 'error');
    }
}

//mantieni la vecchia funzione per retro-compatibilità
function renderOrdiniCliente(ordini) {
    const container = document.getElementById('ordini-container');

    if (!container) return;

    if (!ordini || ordini.length === 0) {
        container.innerHTML = '<p class="text-center">Nessun ordine presente</p>';
        return;
    }

    
    container.innerHTML = ordini.map(ordine => `
        <div class="order-card" onclick="vediDettaglioOrdine('${ordine._id}')">
            <div class="order-header">
                <h4>${escapeHtml(ordine.nomeRistorante)}</h4>
                ${getStatusBadge(ordine.stato)}
            </div>
            <div class="order-body">
                <p><strong>Ordine #${ordine.orderId}</strong></p>
                <p>Totale: ${formatPrice(ordine.totale)}</p>
                <p class="text-muted">${formatDate(ordine.createdAt)}</p>
            </div>
        </div>
    `).join('');
}

function vediDettaglioOrdine(ordineId) {
    window.location.href = `ordine-dettaglio.html?id=${ordineId}`;
}

// ===== FUNZIONI RISTORANTE =====

async function caricaOrdiniRistorante() {
    showLoading(true);
    
    const result = await apiGet(CONFIG.ENDPOINTS.ORDERS_RESTAURANT);
    
    showLoading(false);
    
    if (result.success) {
        renderOrdiniRistorante(result.data.ordini);
    } else {
        showToast('Errore nel caricamento ordini', 'error');
    }
}

function renderOrdiniRistorante(ordini) {
    

    //dividi ordini attivi e completati
    const ordiniAttivi = ordini.filter(o => 
        o.stato !== CONFIG.ORDER_STATES.CONSEGNATO && o.stato !== CONFIG.ORDER_STATES.ANNULLATO
    );
    const ordiniCompletati = ordini.filter(o => 
        o.stato === CONFIG.ORDER_STATES.CONSEGNATO || o.stato === CONFIG.ORDER_STATES.ANNULLATO
    );
    
    //renderizza ordini attivi
    const containerAttivi = document.getElementById('ordini-attivi');
    if (containerAttivi) {
        if (ordiniAttivi.length === 0) {
            containerAttivi.innerHTML = '<p class="text-center text-muted">Nessun ordine attivo</p>';
        } else {
            containerAttivi.innerHTML = renderTabellaOrdiniRistorante(ordiniAttivi);
        }
    }
    
    //renderizza ordini completati
    const containerCompletati = document.getElementById('ordini-completati');
    if (containerCompletati) {
        if (ordiniCompletati.length === 0) {
            containerCompletati.innerHTML = '<p class="text-center text-muted">Nessun ordine completato</p>';
        } else {
            containerCompletati.innerHTML = renderTabellaOrdiniRistorante(ordiniCompletati);
        }
    }
}

function renderTabellaOrdiniRistorante(ordini) {
    const righeTabella = ordini.map(ordine => {
        //lista piatti (usa strMeal che è il campo salvato nel DB)
        const piatti = ordine.piatti.map(p => `${escapeHtml(p.strMeal || p.nome || 'Piatto')} (x${p.quantita})`).join('<br>');
        
        //formatta la data
        const dataOrdine = ordine.createdAt 
            ? new Date(ordine.createdAt).toLocaleString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/D';
        
        // calcola tempo rimanente
        const tempoRimanente = calcolaTempoRimanente(ordine);
        
        return `
            <tr>
                <td>#${ordine.orderId || (ordine._id ? ordine._id.slice(-6) : 'N/D')}</td>
                <td><small>${dataOrdine}</small></td>
                <td>${escapeHtml(ordine.cliente.nome)} ${escapeHtml(ordine.cliente.cognome)}</td>
                <td>${formatPrice(ordine.totale)}</td>
                <td><small>${piatti}</small></td>
                <td>${getStatusBadge(ordine.stato)}</td>
                <td>${tempoRimanente}</td>
                <td>
                    <button class="btn btn-sm btn-primary mb-1" onclick="mostraDettaglioOrdineRistorante('${ordine._id}')">
                        👁️ Dettagli
                    </button><br>
                    ${getBottoneAzione(ordine)}
                </td>
            </tr>
        `;
    }).join('');
    
    return `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID Ordine</th>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Importo</th>
                    <th>Piatti</th>
                    <th>Stato</th>
                    <th>Tempo Attesa</th>
                    <th>Azione</th>
                </tr>
            </thead>
            <tbody>
                ${righeTabella}
            </tbody>
        </table>
    `;
}

async function renderOrdiniRistoranteSeparati(ordini) {
    
    const ordiniInCorso = ordini.filter(o => 
        o.stato !== CONFIG.ORDER_STATES.CONSEGNATO && o.stato !== CONFIG.ORDER_STATES.ANNULLATO
    );
    const ordiniStorico = ordini.filter(o => 
        o.stato === CONFIG.ORDER_STATES.CONSEGNATO || o.stato === CONFIG.ORDER_STATES.ANNULLATO
    );
    
    
    const containerInCorso = document.getElementById('ordini-in-corso');
    if (containerInCorso) {
        if (ordiniInCorso.length === 0) {
            containerInCorso.innerHTML = '<p class="text-center text-muted">Nessun ordine in corso</p>';
        } else {
            containerInCorso.innerHTML = renderTabellaOrdiniRistorante(ordiniInCorso);
        }
    }
    
    
    const containerStorico = document.getElementById('ordini-storico');
    if (containerStorico) {
        if (ordiniStorico.length === 0) {
            containerStorico.innerHTML = '<p class="text-center text-muted">Nessun ordine nello storico</p>';
        } else {
            containerStorico.innerHTML = renderTabellaOrdiniRistorante(ordiniStorico);
        }
    }
}

// funzione helper per ottenere il bottone giusto in base allo stato
function getBottoneAzione(ordine) {
    //se l'ordine è "in preparazione" ma il tempo è scaduto, mostra messaggio di attesa aggiornamento
    if (ordine.stato === CONFIG.ORDER_STATES.IN_PREPARAZIONE && ordine.tempoConsegnaStimato) {
        const tempoConsegna = new Date(ordine.tempoConsegnaStimato);
        const ora = new Date();
        if (ora >= tempoConsegna) {
            return `<button class="btn btn-success btn-sm" disabled>
                        <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                        Aggiornamento automatico in corso...
                    </button>`;
        }
    }
    
    const azioni = {
        [CONFIG.ORDER_STATES.ORDINATO]: {
            testo: 'Segna come In preparazione',
            nuovoStato: CONFIG.ORDER_STATES.IN_PREPARAZIONE,
            classe: 'btn-primary'
        },
        [CONFIG.ORDER_STATES.IN_PREPARAZIONE]: {
            testo: 'Segna come Pronto',
            nuovoStato: CONFIG.ORDER_STATES.PRONTO,
            classe: 'btn-warning'
        },
        [CONFIG.ORDER_STATES.PRONTO]: ordine.tipoOrdine === 'domicilio' ? {
            testo: 'Segna come In consegna',
            nuovoStato: CONFIG.ORDER_STATES.IN_CONSEGNA,
            classe: 'btn-info'
        } : {
            testo: 'In attesa ritiro cliente...',
            nuovoStato: null,
            classe: 'btn-secondary disabled'
        },
        [CONFIG.ORDER_STATES.IN_CONSEGNA]: {
            testo: 'In attesa conferma cliente...',
            nuovoStato: null,
            classe: 'btn-secondary disabled'
        },
        [CONFIG.ORDER_STATES.CONSEGNATO]: {
            testo: 'Completato ✓',
            nuovoStato: null,
            classe: 'btn-success disabled'
        },
        [CONFIG.ORDER_STATES.ANNULLATO]: {
            testo: '❌ Ordine Annullato',
            nuovoStato: null,
            classe: 'btn-danger disabled'
        }
    };
    
    const azione = azioni[ordine.stato] || azioni[CONFIG.ORDER_STATES.ORDINATO];
    
    if (azione.nuovoStato) {
        return `<button class="btn ${azione.classe} btn-sm" onclick="aggiornaStatoOrdine('${ordine._id}', '${azione.nuovoStato}')">${azione.testo}</button>`;
    } else {
        return `<button class="btn ${azione.classe} btn-sm" disabled>${azione.testo}</button>`;
    }
}
async function aggiornaStatoOrdine(ordineId, nuovoStato) {
    //se lo stato è "in preparazione", chiedi prima il tempo di attesa
    if (nuovoStato === CONFIG.ORDER_STATES.IN_PREPARAZIONE) {
        //salva l'ID dell'ordine per usarlo dopo nel modal
        window.ordineIdTempoAttesa = ordineId;
        
        //verifica che Bootstrap sia caricato
        if (typeof bootstrap === 'undefined') {
            console.warn('⚠️ Bootstrap non caricato, uso prompt fallback');
            
            //fallback: usa un prompt semplice
            const minuti = prompt('Inserisci i minuti di attesa per la preparazione (5-120):', '30');
            
            if (!minuti) {
                return; //annullato
            }
            
            const minutiInt = parseInt(minuti);
            if (isNaN(minutiInt) || minutiInt < 5 || minutiInt > 120) {
                showToast('Tempo non valido (deve essere tra 5 e 120 minuti)', 'error');
                return;
            }
            
            //invia direttamente la richiesta
            showLoading(true);
            const endpoint = CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', ordineId);
            const result = await apiPatch(endpoint, { 
                stato: CONFIG.ORDER_STATES.IN_PREPARAZIONE,
                tempoAttesa: minutiInt
            });
            showLoading(false);
            
            if (result.success) {
                showToast(`✅ Ordine in preparazione - Tempo stimato: ${minutiInt} minuti`, 'success');
                caricaOrdiniRistorante();
            } else {
                showToast(result.message || result.error || 'Errore aggiornamento stato', 'error');
            }
            return;
        }
        //apri il modal per il tempo di attesa
        const modalElement = document.getElementById('modalTempoAttesa');
        if (!modalElement) {
            showToast('Errore: Modal tempo attesa non trovato', 'error');
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        return;
    }
    
    // per altri stati, procedi normalmente
    if (!confirm(`Confermi di voler cambiare lo stato in "${nuovoStato}"?`)) {
        return;
    }
    
    showLoading(true);
    
    const endpoint = CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', ordineId);
    const result = await apiPatch(endpoint, { stato: nuovoStato });
    
    showLoading(false);
    
    if (result.success) {
        showToast('Stato aggiornato con successo', 'success');
        caricaOrdiniRistorante(); // ricarica lista
    } else {
        showToast(result.error || 'Errore aggiornamento stato', 'error');
    }
}

async function mostraDettaglioOrdineRistorante(ordineId) {
    //verifica che Bootstrap sia caricato
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap non caricato! Ricarica la pagina.');
        showToast('Errore: Bootstrap non caricato. Ricarica la pagina.', 'error');
        return;
    }
    
    //apri il modal
    const modalElement = document.getElementById('modalDettaglioOrdine');
    if (!modalElement) {
        console.error('Modal element non trovato!');
        showToast('Errore: Modal non trovato', 'error');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    //carica i dettagli dell'ordine (usa endpoint ristorante)
    const result = await apiGet(CONFIG.ENDPOINTS.ORDERS_RESTAURANT_DETAIL.replace('{id}', ordineId));
    
    const modalBody = document.getElementById('modalDettaglioOrdineBody');
    const modalFooter = document.getElementById('modalDettaglioOrdineFooter');
    
    if (!result.success) {
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <strong>Errore:</strong> ${result.message || 'Impossibile caricare i dettagli dell\'ordine'}
            </div>
        `;
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
        `;
        return;
    }
    
    const ordine = result.data?.ordine || result.ordine || result.data;
    
    //console.log('📦 Dati ordine ristorante ricevuti:', ordine); // DEBUG
    
    //verifica che i dati siano completi
    if (!ordine || !ordine.piatti) {
        modalBody.innerHTML = `
            <div class="alert alert-warning">
                <strong>Attenzione:</strong> Dati ordine incompleti
                <pre>${JSON.stringify(result, null, 2)}</pre>
            </div>
        `;
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
        `;
        return;
    }
    
    //renderizza i dettagli (versione ristorante con info cliente)
    modalBody.innerHTML = `
        <!-- Header Ordine -->
        <div class="row mb-3">
            <div class="col-md-6">
                <h6 class="text-muted">Ordine #${ordine.orderId || (ordine._id ? ordine._id.slice(-8).toUpperCase() : 'N/D')}</h6>
                <p class="mb-1"><strong>Data:</strong> ${formatDate(ordine.createdAt)}</p>
                <p class="mb-0"><strong>Stato:</strong> ${getStatusBadge(ordine.stato)}</p>
            </div>
            <div class="col-md-6 text-md-end">
                <h4 class="text-primary mb-0">${formatPrice(ordine.totale)}</h4>
                <p class="text-muted small">Totale ordine</p>
            </div>
        </div>
        
        <hr>
        
        <!-- Info Cliente -->
        <div class="card mb-3 border-0 bg-light">
            <div class="card-body">
                <h6 class="card-title">👤 Cliente</h6>
                <p class="mb-1"><strong>${escapeHtml(ordine.cliente?.nome || 'N/D')} ${escapeHtml(ordine.cliente?.cognome || '')}</strong></p>
                ${ordine.cliente?.telefono ? `<p class="mb-1 small">📞 ${escapeHtml(ordine.cliente.telefono)}</p>` : ''}
                ${ordine.cliente?.indirizzo ? `<p class="mb-0 small">📍 ${escapeHtml(ordine.cliente.indirizzo)}</p>` : ''}
            </div>
        </div>
        
        <!-- Lista Piatti -->
        <h6 class="mb-3">🍽️ Piatti ordinati</h6>
        <div class="list-group mb-3">
            ${ordine.piatti.map(piatto => `
                <div class="list-group-item">
                    <div class="d-flex align-items-center">
                        ${piatto.immagine ? `
                            <img src="${piatto.immagine}" alt="${escapeHtml(piatto.strMeal || piatto.nome)}" 
                                 class="rounded me-3" 
                                 style="width: 60px; height: 60px; object-fit: cover;">
                        ` : ''}
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}</h6>
                            ${piatto.categoria ? `<small class="text-muted">${escapeHtml(piatto.categoria)}</small>` : ''}
                        </div>
                        <div class="text-end">
                            <p class="mb-0"><strong>x${piatto.quantita}</strong></p>
                            <p class="mb-0 text-muted small">${formatPrice(piatto.prezzo)} cad.</p>
                        </div>
                        <div class="text-end ms-3" style="min-width: 80px;">
                            <strong>${formatPrice(piatto.prezzo * piatto.quantita)}</strong>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Metodo Pagamento -->
        <div class="card border-0 bg-light mb-3">
            <div class="card-body">
                <h6 class="card-title">💳 Metodo di Pagamento</h6>
                ${renderMetodoPagamento(ordine.metodoPagamentoUsato)}
            </div>
        </div>
        
        <!-- Tipo Ordine RISTORANTE -->
        <div class="card border-0 bg-light mb-3">
            <div class="card-body">
                <h6 class="card-title">${ordine.tipoOrdine === 'domicilio' ? '🚚' : '🏪'} Tipo Ordine</h6>
                <p class="mb-0"><strong>${ordine.tipoOrdine === 'domicilio' ? 'Consegna a domicilio' : 'Ritiro in loco'}</strong></p>
            </div>
        </div>
        
        <!-- Riepilogo Prezzi -->
        <div class="card border-primary">
            <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                    <span>Subtotale:</span>
                    <strong>${formatPrice(ordine.totale)}</strong>
                </div>
                <hr class="my-2">
                <div class="d-flex justify-content-between">
                    <strong>Totale:</strong>
                    <strong class="text-primary fs-5">${formatPrice(ordine.totale)}</strong>
                </div>
            </div>
        </div>
    `;
    
    //renderizza i pulsanti azione per il ristorante
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
        ${ordine.stato !== CONFIG.ORDER_STATES.CONSEGNATO && ordine.stato !== CONFIG.ORDER_STATES.ANNULLATO ? `
            <button type="button" class="btn btn-primary" onclick="cambiaStatoOrdineModal('${ordine._id}', '${ordine.stato}')">
                🔄 Cambia Stato
            </button>
        ` : ''}
    `;
}

function cambiaStatoOrdineModal(ordineId, statoAttuale) {
    const statiSuccessivi = {
        [CONFIG.ORDER_STATES.ORDINATO]: CONFIG.ORDER_STATES.IN_PREPARAZIONE,
        [CONFIG.ORDER_STATES.IN_PREPARAZIONE]: CONFIG.ORDER_STATES.PRONTO,
        [CONFIG.ORDER_STATES.PRONTO]: CONFIG.ORDER_STATES.IN_CONSEGNA,
        [CONFIG.ORDER_STATES.IN_CONSEGNA]: CONFIG.ORDER_STATES.CONSEGNATO
    };
    
    const nuovoStato = statiSuccessivi[statoAttuale];
    
    if (nuovoStato) {
        //chiudi il modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalDettaglioOrdine'));
        modal.hide();
        
        //aggiorna lo stato
        aggiornaStatoOrdine(ordineId, nuovoStato);
    }
}

// ===== AUTO-INIZIALIZZAZIONE =====

document.addEventListener('DOMContentLoaded', async () => {

    /*
    const maxWait = 100; // max 10 secondi
    let attempts = 0;
    
    while (!document.body.classList.contains('auth-verified') && attempts < maxWait) {
        //await new Promise(resolve => setTimeout(resolve, 100));
        await delay(100); //la riga sopra spostata nella funzine delay() in utils.js
        attempts++;
    }
    // se dopo 10 secondi non è ancora verificato, probabilmente c'è un problema
    if (!document.body.classList.contains('auth-verified')) {
        console.error('Autenticazione non verificata - stop caricamento ordini');
        return;
    }
    */

    const autenticato = await waitAuthVerification();
    if (!autenticato) {
        console.error('Timeout autenticazione');
        return;
    }

    const user = await requireAuth([CONFIG.ROLES.CLIENTE, CONFIG.ROLES.RISTORANTE]);
    if (!user) return;
    
    if (user.ruolo === CONFIG.ROLES.CLIENTE) {
        await caricaOrdiniCliente();
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        await caricaOrdiniRistorante();
    }

    

});

// funzione per confermare il tempo di attesa e aggiornare lo stato
async function confermaTempoAttesa() {
    const minuti = parseInt(document.getElementById('minutiAttesa').value);
    
    if (!minuti || minuti < 5 || minuti > 120) {
        showToast('Inserisci un tempo valido (5-120 minuti)', 'error');
        return;
    }
    
    const ordineId = window.ordineIdTempoAttesa;
    if (!ordineId) {
        showToast('Errore: ID ordine non trovato', 'error');
        return;
    }
    
    //chiudi il modal
    const modalElement = document.getElementById('modalTempoAttesa');
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.hide();
    
    showLoading(true);
    
    //invia la richiesta di aggiornamento con tempo di attesa
    const endpoint = CONFIG.ENDPOINTS.ORDERS_STATUS.replace('{id}', ordineId);
    const result = await apiPatch(endpoint, { 
        stato: CONFIG.ORDER_STATES.IN_PREPARAZIONE,
        tempoAttesa: minuti
    });
    
    showLoading(false);
    
    if (result.success) {
        showToast(`✅ Ordine in preparazione - Tempo stimato: ${minuti} minuti`, 'success');
        caricaOrdiniRistorante(); // ricarica lista
    } else {
        showToast(result.error || 'Errore aggiornamento stato', 'error');
    }
    
    // pulisci la variabile globale
    window.ordineIdTempoAttesa = null;
}

// ===== AGGIORNAMENTO AUTOMATICO TIMER =====

// aggiorna i timer ogni 30 secondi
setInterval(async () => {
    const user = await getUser();
    if (!user) return;
    
    //ricarica gli ordini silenziosamente (senza loading)
    if (user.ruolo === CONFIG.ROLES.CLIENTE) {
        apiGet(CONFIG.ENDPOINTS.ORDERS_MINE).then(result => {
            if (result.success) {
                renderOrdiniClienteSeparati(result.data?.ordini || result.ordini || []);
            }
        });
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        apiGet(CONFIG.ENDPOINTS.ORDERS_RESTAURANT).then(result => {
            if (result.success) {
                renderOrdiniRistoranteSeparati(result.data?.ordini || result.ordini || []);
            }
        });
    }
}, 30000); // 30 secondi
