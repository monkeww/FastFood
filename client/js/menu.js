
// ===== VARIABILI PAGINAZIONE PIATTI COMUNI =====
let piattiComuniCompleti = []; // Array completo dei piatti
let piattiComuniMostrati = 0;  // Quanti piatti sono attualmente mostrati
const PIATTI_PER_PAGINA = 20;  // Quanti piatti mostrare per volta

// widget upload immagine piatto personalizzato
let uploadPiattoWidget = null;
let uploadEditPiattoWidget = null; 

// variabile per memorizzare il piatto corrente in modifica
let piattoCorrenteModifica = null;


// ===== FUNZIONI CLIENTE =====

async function caricaMenuCliente() {
    showLoading(true);
    const restaurantId = getRestaurantIdFromURL();
    
    // carica info ristorante per l'header 
    await caricaInfoRistorante(restaurantId);
    
    const menuResult = await apiGet(CONFIG.ENDPOINTS.MENU_RESTAURANT.replace('{id}', restaurantId));
    showLoading(false);

    if (!menuResult.success) {
        showToast('Errore nel caricamento del menu: ' + (menuResult.error || 'Errore sconosciuto'), 'error');
        return;
    }

    if (menuResult.success) {
        renderMenuCliente(menuResult.data.menu);
    }
}

async function caricaInfoRistorante(restaurantId) {
    try {
        const result = await apiGet(CONFIG.ENDPOINTS.RESTAURANTS);
        
        if (result.success && result.data && result.data.ristoranti) {
            const ristorante = result.data.ristoranti.find(r => r.id === restaurantId);
            
            if (ristorante) {
                // aggiorna header con info ristorante
                const nomeRistorante = document.getElementById('nomeRistorante');
                const infoRistorante = document.getElementById('infoRistorante');
                
                if (nomeRistorante) {
                    nomeRistorante.textContent = ristorante.nome || 'Ristorante';
                }
                
                if (infoRistorante) {
                    infoRistorante.innerHTML = `
                        📍 ${escapeHtml(ristorante.indirizzo || 'Indirizzo non disponibile')} 
                        ${ristorante.telefono ? `| 📞 ${escapeHtml(ristorante.telefono)}` : ''}
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento info ristorante:', error);
    }
}

async function renderMenuCliente(menu) {
    const menuContainer = document.getElementById('menu-container');
    
    if (!menuContainer) return;
    
    if (!menu || menu.length === 0) {
        menuContainer.innerHTML = '<p class="text-center text-muted">Nessun piatto disponibile</p>';
        return;
    }
    
    menuContainer.innerHTML = menu.map(piatto => `
        <div class="col-md-3 mb-3">
            <div class="card card-menu position-relative">
                <button class="btn btn-sm btn-light btn-dettagli-piatto" 
                        onclick="mostraDettagliPiattoModal('${piatto._id}', true)" 
                        title="Dettagli">
                    🔍
                </button>
                <img src="${escapeHtml(piatto.strMealThumb || 'https://via.placeholder.com/500x300?text=No+Image')}" 
                     class="card-img-top" 
                     alt="${escapeHtml(piatto.strMeal)}">
                <div class="card-body d-flex flex-column">
                    <span class="colore-arancione">${escapeHtml(piatto.strCategory || 'Altro')}</span>
                    <h5 class="card-title">${escapeHtml(piatto.strMeal)}</h5>
                    <p class="card-text">${piatto.ingredients ? escapeHtml(piatto.ingredients.slice(0, 4).join(', ')) : 'Ingredienti non disponibili'}${piatto.ingredients && piatto.ingredients.length > 3 ? '...' : ''}</p>
                    <div class="card-actions">
                        <div class="prezzo-piatto">${formatPrice(piatto.prezzo)}</div>
                        <div id="controls-${piatto._id}">
                            ${getQuantityControls(piatto._id, piatto.strMeal, piatto.prezzo)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // carica il carrello dal server per sincronizzare le quantità
    await inizializzaCarrello();
}

// ===== FUNZIONI RISTORANTE =====

async function caricaMenuRistorante(user) {
    showLoading(true);
    const menuResult = await apiGet(CONFIG.ENDPOINTS.MENU);
    showLoading(false);
    
    if (!menuResult.success) {
        showToast('Errore nel caricamento del menu', 'error');
        return;
    }
    
    renderMenuRistorante(menuResult.data.menu);
}

function renderMenuRistorante(menu) {
    const menuContainer = document.getElementById('menu-ristorante-container');
    
    if (!menuContainer) return;
    
    if (!menu || menu.length === 0) {
        menuContainer.innerHTML = '<p class="text-center text-muted">Nessun piatto nel tuo menu</p>';
        return;
    }
    
    menuContainer.innerHTML = menu.map(piatto => `
        <div class="col-md-3 mb-3">
            <div class="card card-menu position-relative">
                <button class="btn btn-sm btn-light btn-dettagli-piatto" 
                        onclick="mostraDettagliPiattoModal('${piatto._id}')" 
                        title="Dettagli">
                    👁️
                </button>
                <img src="${escapeHtml(piatto.strMealThumb || 'https://via.placeholder.com/500x300?text=No+Image')}" 
                     class="card-img-top" 
                     alt="${escapeHtml(piatto.strMeal)}">
                <div class="card-body d-flex flex-column">
                    <span class="colore-arancione">${escapeHtml(piatto.strCategory || 'Altro')}</span>
                    <h5 class="card-title">${escapeHtml(piatto.strMeal)}</h5>
                    <p class="card-text">${piatto.ingredients ? escapeHtml(piatto.ingredients.slice(0, 3).join(', ')) : 'N/D'}${piatto.ingredients && piatto.ingredients.length > 3 ? '...' : ''}</p>
                    <div class="card-actions">
                        <div class="prezzo-piatto">${formatPrice(piatto.prezzo)}</div>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline-primary" onclick="modificaPiatto('${piatto._id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="eliminaPiatto('${piatto._id}')">Elimina</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}



async function caricaCategorie() {
    const categorieResult = await apiGet(CONFIG.ENDPOINTS.MEALS_CATEGORIES);
    
    if (!categorieResult.success) {
        console.error('Errore caricamento categorie:', categorieResult.error);
        return;
    }
    
    const selectCategoria = document.getElementById('categoriaPiatto');
    if (!selectCategoria) return;
    
    const categories = categorieResult.data.categories || [];
    
    // aggiungi le opzioni al select
    selectCategoria.innerHTML = '<option value="">Seleziona categoria</option>' + 
        categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

async function caricaPiattiComuni() {
    showLoading(true);
    const piattiResult = await apiGet(CONFIG.ENDPOINTS.MEALS);
    showLoading(false);

    if (!piattiResult.success) {
        showToast('Errore nel caricamento dei piatti: ' + (piattiResult.error || 'Errore sconosciuto'), 'error');
        return;
    }

    if (piattiResult.success) {
        piattiComuniCompleti = piattiResult.data.meals || [];
        piattiComuniMostrati = 0; // reset
        renderPiattiComuni();
    }
}

async function cercaPiattiComuni(nome, categoria, origine) {
    // se non ci sono filtri, carica tutti i piatti 
    // 
    if (!nome && !categoria && !origine) {
        await caricaPiattiComuni();
        return;
    }
    
    // costruisce la query string  per i parametri di ricerca (es: ?q=pizza&category=italian)
    const params = new URLSearchParams();
    if (nome) params.append('q', nome);
    if (categoria) params.append('category', categoria);
    if (origine) params.append('area', origine);
    
    showLoading(true);
    const piattiResult = await apiGet(`${CONFIG.ENDPOINTS.MEALS_SEARCH}?${params.toString()}`);
    showLoading(false);

    if (!piattiResult.success) {
        showToast('Errore nella ricerca: ' + (piattiResult.error || 'Errore sconosciuto'), 'error');
        return;
    }

    if (piattiResult.success) {
        piattiComuniCompleti = piattiResult.data.meals || [];
        piattiComuniMostrati = 0; // reset
        renderPiattiComuni();
        
        if (piattiComuniCompleti.length === 0) {
            showToast('Nessun piatto trovato con i criteri selezionati', 'info');
        } else {
            showToast(`✅ Trovati ${piattiComuniCompleti.length} piatti`, 'success');
        }
    }
}

function mostraAltriPiatti() {
    renderPiattiComuni();
}

function renderPiattiComuni() { 
    // lato ristorante: mostra piatti comuni del database per aggiungerli al proprio menu con paginazione
    const piattiContainer = document.getElementById('risultatiRicerca');
    
    if (!piattiContainer) return;
    
    if (!piattiComuniCompleti || piattiComuniCompleti.length === 0) {
        piattiContainer.innerHTML = '<p class="text-center text-muted">Nessun piatto disponibile</p>';
        return;
    }
    
    // calcola quanti piatti mostrare
    const nuovoLimite = piattiComuniMostrati + PIATTI_PER_PAGINA;
    const piattiDaMostrare = piattiComuniCompleti.slice(0, nuovoLimite);
    piattiComuniMostrati = nuovoLimite;

    /*
    nuovo limite è il numero totale di piatti da mostrare dopo aver cliccato "Mostra altro".

        esempio:

        inzio: piattiComuniMostrati = 0
        primo caricamento: nuovoLimite = 0 + 12 = 12 → mostra piatti da 0 a 12
        click "Mostra altro": nuovoLimite = 12 + 12 = 24 → mostra piatti da 0 a 24
         click ancora: nuovoLimite = 24 + 12 = 36 → mostra piatti da 0 a 36
    */
    
    // genera le card
    const cardsHTML = piattiDaMostrare.map(piatto => `
        <div class="col-md-3 mb-3">
            <div class="card card-menu position-relative">
                <button class="btn btn-sm btn-light btn-dettagli-piatto" 
                        onclick="mostraDettagliPiattoModal('${piatto.idMeal}')" 
                        title="Dettagli">
                    🔍
                </button>
                <img src="${escapeHtml(piatto.strMealThumb || 'https://via.placeholder.com/500x300?text=No+Image')}" 
                     class="card-img-top" 
                     alt="${escapeHtml(piatto.strMeal)}">
                <div class="card-body d-flex flex-column">
                    <span class="colore-arancione">${escapeHtml(piatto.strCategory || 'Altro')}</span>
                    <h5 class="card-title">${escapeHtml(piatto.strMeal)}</h5>
                    <p class="card-text">${piatto.ingredients ? escapeHtml(piatto.ingredients.slice(0, 3).join(', ')) : 'N/D'}${piatto.ingredients && piatto.ingredients.length > 3 ? '...' : ''}</p>
                    <div class="card-actions">
                        <div class="input-group me-2" style="max-width: 120px;">
                            <span class="input-group-text fastfood-input-prezzo">€</span>
                            <input type="number" class="form-control fastfood-input-prezzo" id="prezzo-${piatto.idMeal}" value="5.00" step="0.01" min="0">
                        </div>
                        <button class="btn btn-primary" 
                                onclick="aggiungiPiattoAlMenu('${piatto.idMeal}', '${escapeHtml(piatto.strMeal).replace(/'/g, "\\'")}')">
                            Aggiungi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // aggiungi il bottone "Mostra altro" se ci sono altri piatti
    const bottoneHTML = piattiComuniMostrati < piattiComuniCompleti.length ? `
        <div class="col-12 text-center mb-4">
            <button class="btn btn-outline-primary btn-lg" onclick="mostraAltriPiatti()">
                Mostra altri piatti (${piattiComuniCompleti.length - piattiComuniMostrati} rimanenti)
            </button>
        </div>
    ` : '';
    
    piattiContainer.innerHTML = cardsHTML + bottoneHTML;
}

// ===== FUNZIONI HELPER =====

function getRestaurantIdFromURL() {
    // prende l'ID del ristorante dall'URL (es: menu.html?restaurantId=123)
    return getUrlParameter('restaurantId');
}


/*
async function aggiungiAlCarrello(piattoId, nomePiatto, prezzo) {
    showLoading(true);
    
    const result = await apiPost(CONFIG.ENDPOINTS.CART_ADD, {
        menuItemId: piattoId,
        quantita: 1
    });
    
    showLoading(false);
    
    if (result.success) {
        showToast(`✅ ${nomePiatto} aggiunto al carrello!`, 'success');
    } else {
        showToast(`❌ Errore: ${result.error || 'Impossibile aggiungere al carrello'}`, 'error');
    }
}

*/

async function aggiungiPiattoAlMenu(piattoId, nomePiatto) {
    // prende il prezzo dall'input field
    const inputPrezzo = document.getElementById(`prezzo-${piattoId}`);
    
    if (!inputPrezzo) {
        showToast('Errore: campo prezzo non trovato', 'error');
        return;
    }
    
    const prezzo = inputPrezzo.value;
    
    if (!prezzo || isNaN(prezzo) || parseFloat(prezzo) <= 0) {
        showToast('Inserisci un prezzo valido', 'error');
        inputPrezzo.focus();
        return;
    }
    
    showLoading(true);
    
    const result = await apiPost(CONFIG.ENDPOINTS.MENU_ADD, {
        piattoComuneId: piattoId,
        prezzo: parseFloat(prezzo)
    });
    
    showLoading(false);
    
    if (result.success) {
        showToast(`✅ ${nomePiatto} aggiunto al tuo menu!`, 'success');
        // ricarica il menu del ristorante
        const user = await getUser();
        await caricaMenuRistorante(user);
    } else {
        showToast(`❌ Errore: ${result.error || 'Impossibile aggiungere al menu'}`, 'error');
    }
}

async function modificaPiatto(piattoId) {
    showLoading(true);
    
    // carica il menu per trovare il piatto
    const menuResult = await apiGet(CONFIG.ENDPOINTS.MENU);
    showLoading(false);
    
    if (!menuResult.success) {
        showToast('Errore nel caricamento del piatto', 'error');
        return;
    }
    
    const piatto = menuResult.data.menu.find(p => p._id === piattoId);
    
    if (!piatto) {
        showToast('Piatto non trovato', 'error');
        return;
    }
    
    piattoCorrenteModifica = piatto;
    
    // se è un piatto personalizzato, apri modal completo
    if (piatto.piattoPersonalizzato) {
        apriModalModificaPiattoPersonalizzato(piatto);
    } else {
        // piatto del database: solo prezzo modificabile
        apriModalModificaPrezzo(piatto);
    }
}

function apriModalModificaPiattoPersonalizzato(piatto) {
    // popola il form
    document.getElementById('editPiattoId').value = piatto._id;
    document.getElementById('editNomePiatto').value = piatto.strMeal || '';
    document.getElementById('editPrezzoPiatto').value = piatto.prezzo || 0;
    document.getElementById('editIngredientiPiatto').value = piatto.ingredients ? piatto.ingredients.join(', ') : '';
    
    // popola select categorie
    const selectCategoria = document.getElementById('editCategoriaPiatto');
    if (selectCategoria && selectCategoria.options.length <= 1) {
        // copia le categorie dal form principale
        const categorieOriginale = document.getElementById('categoriaPiatto');
        if (categorieOriginale) {
            selectCategoria.innerHTML = categorieOriginale.innerHTML;
        }
    }
    selectCategoria.value = piatto.strCategory || '';
    
    // inizializza widget upload se non esiste
    if (!uploadEditPiattoWidget) {
        uploadEditPiattoWidget = createImageUploadWidget({
            containerId: 'uploadEditPiattoWidget',
            currentImage: piatto.strMealThumb || '',
            placeholder: 'Modifica immagine piatto'
        });
    } else {
        uploadEditPiattoWidget.setImage(piatto.strMealThumb || '');
    }
    
    // recupera elemento modal e assicura che sia figlio diretto di body (Bootstrap backdrop/z-index)
    const modalEl = document.getElementById('modalModificaPiattoPersonalizzato');
    if (!modalEl) {
        console.error('Modal modifica piatto personalizzato non trovato');
        return;
    }

    // aggiungi attributi accessibilità mancanti
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.removeAttribute('aria-hidden');
    modalEl.style.display = ''; // rimuovi eventuale display none persistente

    // se il modal non è direttamente nel body lo spostiamo per evitare context stacking che rompe grafica
    if (modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }

    // salva elemento precedentemente a fuoco
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const modal = new bootstrap.Modal(modalEl, { focus: true });
    modal.show();

    // focus iniziale sul titolo o sul close
    const closeBtn = modalEl.querySelector('.btn-close');
    if (closeBtn) {
        setTimeout(() => closeBtn.focus(), 60);
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        // ripristina attributo aria-hidden per stato iniziale (non necessario ma coerente con bootstrap)
        modalEl.setAttribute('aria-hidden', 'true');
        if (previouslyFocused && previouslyFocused.isConnected) {
            previouslyFocused.focus();
        }
    }, { once: true });
}

function apriModalModificaPrezzo(piatto) {
    document.getElementById('prezzoPiattoId').value = piatto._id;
    document.getElementById('prezzoNomePiatto').textContent = piatto.strMeal || '';
    document.getElementById('prezzoNuovoPrezzo').value = piatto.prezzo || 0;
    
    const modal = new bootstrap.Modal(document.getElementById('modalModificaPrezzo'));
    modal.show();
}

async function salvaModificaPiattoPersonalizzato() {
    try {
        const piattoId = document.getElementById('editPiattoId').value;
        
        // gestione immagine (supporta nessuna modifica, URL o file)
        let imageUrl = piattoCorrenteModifica.strMealThumb;
        if (uploadEditPiattoWidget) {
            try {
                const uploadResult = await uploadEditPiattoWidget.getFinalUploadResult();
                if (uploadResult.imageUrl) {
                    imageUrl = uploadResult.imageUrl;
                }
            } catch (error) {
                console.warn('Immagine non modificata (fallback):', error.message);
            }
        }
        
        const ingredienti = document.getElementById('editIngredientiPiatto').value
            .split(',')
            .map(i => i.trim())
            .filter(i => i.length > 0);
        
        showLoading(true);
        
        const result = await apiPatch(CONFIG.ENDPOINTS.MENU_UPDATE.replace('{menuItemId}', piattoId), {
            strMeal: document.getElementById('editNomePiatto').value.trim(),
            strCategory: document.getElementById('editCategoriaPiatto').value.trim(),
            prezzo: parseFloat(document.getElementById('editPrezzoPiatto').value),
            ingredients: ingredienti,
            strMealThumb: imageUrl
        });
        
        showLoading(false);
        
        if (result.success) {
            showToast('✅ Piatto aggiornato!', 'success');
            
            // chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificaPiattoPersonalizzato'));
            modal.hide();
            
            //ricarica menu
            const user = await getUser();
            await caricaMenuRistorante(user);
        } else {
            showToast(` Errore: ${result.error || 'Impossibile modificare'}`, 'error');
        }
    } catch (error) {
        showLoading(false);
        showToast('Errore: ' + error.message, 'error');
    }
}

async function salvaModificaPrezzo() {
    const piattoId = document.getElementById('prezzoPiattoId').value;
    const nuovoPrezzo = parseFloat(document.getElementById('prezzoNuovoPrezzo').value);
    
    if (isNaN(nuovoPrezzo) || nuovoPrezzo <= 0) {
        showToast('Prezzo non valido', 'error');
        return;
    }
    
    showLoading(true);
    
    const result = await apiPatch(CONFIG.ENDPOINTS.MENU_UPDATE.replace('{menuItemId}', piattoId), {
        prezzo: nuovoPrezzo
    });
    
    showLoading(false);
    
    if (result.success) {
        showToast('✅ Prezzo aggiornato!', 'success');
        
        // chiudi modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificaPrezzo'));
        modal.hide();
        
        // ricarica menu
        const user = await getUser();
        await caricaMenuRistorante(user);
    } else {
        showToast(`❌ Errore: ${result.error || 'Impossibile modificare'}`, 'error');
    }
}

async function eliminaPiatto(piattoId) {
    if (!confirm('Sei sicuro di voler eliminare questo piatto dal menu?')) {
        return;
    }
    
    showLoading(true);
    
    const result = await apiDelete(CONFIG.ENDPOINTS.MENU_REMOVE.replace('{menuItemId}', piattoId));
    
    showLoading(false);
    
    if (result.success) {
        showToast('✅ Piatto rimosso dal menu!', 'success');
        const user = await getUser();
        await caricaMenuRistorante(user);
    } else {
        showToast(`❌ Errore: ${result.error || 'Impossibile eliminare'}`, 'error');
    }
}

// ===== MODAL DETTAGLI PIATTO =====

async function mostraDettagliPiattoModal(piattoId, isCliente = false) {
    showLoading(true);
    
    // determina se è un piatto del menu (ObjectId lungo) o un piatto comune (idMeal numerico)
    let piatto;
    
    if (piattoId.length > 15) {
        // è un _id del menu, carica dal menu
        let menuResult;
        
        if (isCliente) {
            // cliente: carica menu del ristorante specifico
            const restaurantId = getRestaurantIdFromURL();
            menuResult = await apiGet(CONFIG.ENDPOINTS.MENU_RESTAURANT.replace('{id}', restaurantId));
        } else {
            // ristorante: carica il proprio menu
            menuResult = await apiGet(CONFIG.ENDPOINTS.MENU);
        }
        
        if (!menuResult.success) {
            showLoading(false);
            showToast('Errore nel caricamento dei dettagli', 'error');
            return;
        }
        
        piatto = menuResult.data.menu.find(p => p._id === piattoId);
        
        if (!piatto) {
            showLoading(false);
            showToast('Piatto non trovato nel menu', 'error');
            return;
        }
    } else {
        // è un idMeal, carica dal database meals usando MEALS_DETAIL
        const result = await apiGet(CONFIG.ENDPOINTS.MEALS_DETAIL.replace('{id}', piattoId));
        
        console.log('Risposta API meals detail:', result);
        
        showLoading(false);
        
        if (!result || !result.success) {
            console.error('Errore API:', result);
            showToast(result?.error || 'Errore nel caricamento dei dettagli', 'error');
            return;
        }
        
        // l'endpoint restituisce { success: true, data: { success: true, meal: {...} } }
        // il wrapper apiGet annida la risposta, quindi accediamo a result.data.meal
        piatto = result.data?.meal || result.data;
        
        if (!piatto) {
            console.error('Piatto non trovato nella risposta:', result);
            showToast('Piatto non trovato', 'error');
            return;
        }
    }
    
    showLoading(false);
    
    console.log('Piatto da mostrare nel modal:', piatto);
    console.log('Campi piatto:', {
        strMeal: piatto.strMeal,
        strCategory: piatto.strCategory,
        strArea: piatto.strArea,
        strMealThumb: piatto.strMealThumb,
        strTags: piatto.strTags,
        ingredients: piatto.ingredients
    });
    
    if (!piatto) {
        showToast('Errore: dati piatto non validi', 'error');
        return;
    }
    
    // crea il modal HTML
    // salva elemento precedentemente a fuoco per ripristinarlo dopo chiusura
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const modalHTML = `
        <div class="modal fade modal-dettagli-piatto" id="modalDettagliPiatto" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <img src="${escapeHtml(piatto.strMealThumb || piatto.immagine || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'500\' height=\'300\'/%3E%3Ctext fill=\'%23999\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'sans-serif\' font-size=\'24\'%3ENessuna immagine%3C/text%3E%3C/svg%3E')}" 
                             class="img-fluid rounded mb-3" 
                             alt="${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}"
                             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'500\\' height=\\'300\\'%3E%3Crect fill=\\'%23ddd\\' width=\\'500\\' height=\\'300\\'/%3E%3Ctext fill=\\'%23999\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' font-family=\\'sans-serif\\' font-size=\\'24\\'%3ENessuna immagine%3C/text%3E%3C/svg%3E'">
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Categoria:</strong>
                                <p>${escapeHtml(piatto.strCategory || piatto.categoria || 'N/D')}</p>
                            </div>
                            <div class="col-md-6">
                                <strong>Origine:</strong>
                                <p>${escapeHtml(piatto.strArea || piatto.origine || 'N/D')}</p>
                            </div>
                        </div>
                        
                        ${piatto.prezzo ? `
                            <div class="mb-3">
                                <strong>Prezzo:</strong>
                                <p class="prezzo-piatto">€ ${piatto.prezzo.toFixed(2)}</p>
                            </div>
                        ` : ''}
                        
                        ${piatto.strTags || piatto.tags ? `
                            <div class="mb-3">
                                <strong>Tags:</strong>
                                <p>${escapeHtml(piatto.strTags || piatto.tags)}</p>
                            </div>
                        ` : ''}
                        
                        <div class="mb-3">
                            <strong>Ingredienti:</strong>
                            <ul class="list-unstyled">
                                ${piatto.ingredients ? piatto.ingredients.map(ing => `<li>• ${escapeHtml(ing)}</li>`).join('') : '<li>N/D</li>'}
                            </ul>
                        </div>
                        
                        ${piatto.strInstructions || piatto.descrizione ? `
                            <div class="mb-3">
                                <strong>Preparazione:</strong>
                                <p>${escapeHtml(piatto.strInstructions || piatto.descrizione)}</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-arancione" data-bs-dismiss="modal">Chiudi</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // rimuovi eventuali modal precedenti
    const existingModal = document.getElementById('modalDettagliPiatto');
    if (existingModal) {
        existingModal.remove();
    }
    
    // aggiungi il modal al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // mostra il modal
    const modalElement = document.getElementById('modalDettagliPiatto');
    const modal = new bootstrap.Modal(modalElement, {
        focus: true
    });
    modal.show();

    // forza focus sul primo elemento cliccabile (close button) dopo apertura per evitare focus su elemento nascosto
    const closeBtn = modalElement.querySelector('.btn-close');
    if (closeBtn) {
        setTimeout(() => closeBtn.focus(), 50);
    }

    // ripristina focus e rimuove modal dal DOM quando viene chiuso
    modalElement.addEventListener('hidden.bs.modal', () => {
        modalElement.remove();
        if (previouslyFocused && previouslyFocused.isConnected) {
            previouslyFocused.focus();
        } else {
            // fallback focus
            document.body.focus();
        }
    });
}

async function aggiungiPiattoPersonalizzato(formData) {
    const { nomePiatto, categoriaPiatto, prezzoPiatto, ingredientiPiatto, strMealThumb } = formData;
    
    // validazione
    if (!nomePiatto || !categoriaPiatto || !prezzoPiatto || !ingredientiPiatto) {
        showToast('Compila tutti i campi obbligatori', 'error');
        return;
    }
    
    if (parseFloat(prezzoPiatto) <= 0) {
        showToast('Il prezzo deve essere maggiore di 0', 'error');
        return;
    }
    
    // converte gli ingredienti da stringa a array
    const ingredientsArray = ingredientiPiatto.split(',').map(ing => ing.trim()).filter(ing => ing.length > 0);
    
    if (ingredientsArray.length === 0) {
        showToast('Inserisci almeno un ingrediente', 'error');
        return;
    }
    
    showLoading(true);
    
    const result = await apiPost(CONFIG.ENDPOINTS.MENU_ADD, {
        piattoPersonalizzato: true,
        strMeal: nomePiatto,
        strCategory: categoriaPiatto,
        ingredients: ingredientsArray,
        strMealThumb: strMealThumb || '',
        prezzo: parseFloat(prezzoPiatto)
    });
    
    showLoading(false);
    
    if (result.success) {
        showToast(`✅ ${nomePiatto} aggiunto al tuo menu!`, 'success');
        
        // reset del form
        document.getElementById('aggiungiPiattoForm').reset();
        
        // reset widget upload
        if (uploadPiattoWidget) {
            uploadPiattoWidget.reset();
        }
        
        // ricarica il menu
        const user = await getUser();
        await caricaMenuRistorante(user);
    } else {
        showToast(` Errore: ${result.message || result.error || 'Impossibile aggiungere il piatto'}`, 'error');
    }
}

// ===== AUTO-INIZIALIZZAZIONE =====

document.addEventListener('DOMContentLoaded', async () => {
    /*
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    
    /* non serve autenticazoine per visualizzare menu di un ristorante , ma se voglio caricare il menu per il 
    ristorante autenticato o per il cliente autenticato, allora si.

   const autenticato = await waitAuthVerification();
    if (!autenticato) {
        console.error('Timeout autenticazione');
        return;
    }
    */
    const user = await getUser();

    // dispatcher: carica menu in base al ruolo
    if (!user || user.ruolo === CONFIG.ROLES.CLIENTE) {
        // cliente: carica menu del ristorante selezionato
        await caricaMenuCliente();
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        // ristorante: carica il proprio menu + piatti comuni disponibili
        await caricaMenuRistorante(user);
        
        // carica le categorie per il form piatto personalizzato
        await caricaCategorie();
        
        // inizializza widget upload immagine
        const uploadContainer = document.getElementById('uploadPiattoWidget');
        if (uploadContainer) {
            uploadPiattoWidget = createImageUploadWidget({
                containerId: 'uploadPiattoWidget',
                currentImage: '',
                placeholder: 'Aggiungi immagine piatto'
            });
        }
        
        // se c'è il container per i piatti comuni, caricali
        if (document.getElementById('piatti-comuni-container')) {
            await caricaPiattiComuni();
        }
        
        // listener per il form di aggiunta piatto personalizzato
        const formPiattoPersonalizzato = document.getElementById('aggiungiPiattoForm');
        if (formPiattoPersonalizzato) {
            formPiattoPersonalizzato.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    // gestione immagine (opzionale, URL o file)
                    let imageUrl = '';
                    if (uploadPiattoWidget) {
                        try {
                            const uploadResult = await uploadPiattoWidget.getFinalUploadResult();
                            imageUrl = uploadResult.imageUrl || '';
                        } catch (error) {
                            console.warn('Errore gestione immagine, procedo senza:', error.message);
                        }
                    }
                    
                    const formData = {
                        nomePiatto: document.getElementById('nomePiatto').value.trim(),
                        categoriaPiatto: document.getElementById('categoriaPiatto').value.trim(),
                        prezzoPiatto: document.getElementById('prezzoPiatto').value,
                        ingredientiPiatto: document.getElementById('ingredientiPiatto').value.trim(),
                        strMealThumb: imageUrl
                    };
                    
                    await aggiungiPiattoPersonalizzato(formData);
                } catch (error) {
                    showToast('Errore: ' + error.message, 'error');
                }
            });
        }

        //bottone apertura modal aggiunta piatto personalizzato
        const btnApriModalAggiungi = document.getElementById('btnApriModalAggiungiPiattoPersonalizzato');
        const modalAggiungiEl = document.getElementById('modalAggiungiPiattoPersonalizzato');
        if (btnApriModalAggiungi && modalAggiungiEl) {
            btnApriModalAggiungi.addEventListener('click', () => {
                //reset form ogni apertura
                formPiattoPersonalizzato.reset();
                if (uploadPiattoWidget) {
                    uploadPiattoWidget.reset();
                }
                //focus iniziale sul nome piatto
                setTimeout(() => {
                    const nomeInput = document.getElementById('nomePiatto');
                    if (nomeInput) nomeInput.focus();
                }, 100);
                const modal = new bootstrap.Modal(modalAggiungiEl, { focus: true });
                modal.show();
            });
        }
        
        //listener per il form di ricerca piatti comuni
        const formCercaPiatto = document.getElementById('cercaPiattoForm');
        if (formCercaPiatto) {
            formCercaPiatto.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nome = document.getElementById('cercaNomePiatto').value.trim();
                const categoria = document.getElementById('cercaCategoriaPiatto').value.trim();
                const origine = document.getElementById('cercaOriginePiatto').value.trim();
                
                await cercaPiattiComuni(nome, categoria, origine);
            });
        }
    }
});