// ===== GESTIONE HOMEPAGE =====

const NUMERO_PIATTI_EVIDENZA = 3; // numero di piatti casuali da mostrare

async function caricaPiattiInEvidenza() {
    try {
        showLoading(true);
        
        // carica tutti i ristoranti
        const ristorantiResult = await apiGet(CONFIG.ENDPOINTS.RESTAURANTS);
        
        if (!ristorantiResult.success || !ristorantiResult.data?.ristoranti) {
            console.error('Errore nel caricamento ristoranti:', ristorantiResult);
            mostraPiattiStatici(); //funzione per sicurezza
            return;
        }
        
        const ristoranti = ristorantiResult.data.ristoranti;
        
        if (ristoranti.length === 0) {
            mostraPiattiStatici();
            return;
        }
        
        // carica i menu di tutti i ristoranti
        const tuttiPiatti = [];
        
        for (const ristorante of ristoranti) {
            try {
                const menuResult = await apiGet(CONFIG.ENDPOINTS.MENU_RESTAURANT.replace('{id}', ristorante.id));
                
                if (menuResult.success && menuResult.data?.menu) {
                    // aggiungi info ristorante a ogni piatto
                    menuResult.data.menu.forEach(piatto => {
                        tuttiPiatti.push({
                            ...piatto, //... mantiene tutte le proprieta del piatto, le copia invariate,
                            ristoranteId: ristorante.id,
                            nomeRistorante: ristorante.nome,
                            indirizzoRistorante: ristorante.indirizzo
                        });
                    });
                }
            } catch (error) {
                console.error(`Errore caricamento menu ristorante ${ristorante.nome}:`, error);
            }
        }
        
        if (tuttiPiatti.length === 0) {
            mostraPiattiStatici();
            return;
        }
        
        // controlla se l'utente è loggato e ha preferenze
        const user = await getUser();
        let piattiSelezionati = [];
        
        if (user && user.ruolo === CONFIG.ROLES.CLIENTE && user.preferenze && user.preferenze.length > 0) {
            console.log('👤 Utente cliente loggato con preferenze:', user.preferenze);
            // seleziona piatti basati sulle preferenze
            piattiSelezionati = selezionaPiattiPerPreferenze(tuttiPiatti, user.preferenze, NUMERO_PIATTI_EVIDENZA);
            
            if (piattiSelezionati.length === 0) {
                console.log(' Nessun piatto trovato per le preferenze, uso casuali');
                piattiSelezionati = selezionaPiattiCasuali(tuttiPiatti, NUMERO_PIATTI_EVIDENZA);
            }
        } else {
            console.log(' Utente non loggato o senza preferenze, uso piatti casuali');
            // Seleziona piatti casuali
            piattiSelezionati = selezionaPiattiCasuali(tuttiPiatti, NUMERO_PIATTI_EVIDENZA);
        }
        
        // renderizza i piatti selezionati
        renderPiattiInEvidenza(piattiSelezionati, user);

        showLoading(false);
        
    } catch (error) {
        console.error('Errore nel caricamento piatti in evidenza:', error);
        showLoading(false);
        mostraPiattiStatici();
    }
}

function selezionaPiattiCasuali(piatti, numero) {
    // mescola l'array usando fisher-yates shuffle
    const piattiMescolati = [...piatti];
    
    for (let i = piattiMescolati.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [piattiMescolati[i], piattiMescolati[j]] = [piattiMescolati[j], piattiMescolati[i]];
    }
    
    // prendi i primi N piatti
    return piattiMescolati.slice(0, numero); //NUmero= 3 
}

function selezionaPiattiPerPreferenze(piatti, preferenze, numero) {
    console.log(' Selezione piatti per preferenze:', preferenze);
    
    // filtra piatti che appartengono alle categorie preferite
    const piattiPreferiti = piatti.filter(piatto => {
        const categoria = piatto.strCategory || piatto.categoria || '';
        return preferenze.some(pref => 
            categoria.toLowerCase().includes(pref.toLowerCase()) || 
            pref.toLowerCase().includes(categoria.toLowerCase())
        );
    });
    
    console.log(`🔍 Trovati ${piattiPreferiti.length} piatti nelle categorie preferite`);
    
    if (piattiPreferiti.length === 0) {
        return [];
    }
    
    // se ci sono abbastanza piatti preferiti, scegli casuali da quelli
    if (piattiPreferiti.length >= numero) {
        return selezionaPiattiCasuali(piattiPreferiti, numero);
    } else {
        // se non ci son abbastanza piatti preferiti, prendili tutti e completa con casuali
        const piattiRimanenti = piatti.filter(p => !piattiPreferiti.includes(p));
        const piattiCasualiExtra = selezionaPiattiCasuali(piattiRimanenti, numero - piattiPreferiti.length);
        return [...piattiPreferiti, ...piattiCasualiExtra];
    }
}


function renderPiattiInEvidenza(piatti, user = null) {
    const container = document.getElementById('piatti-in-evidenza-container');
    
    if (!container) return;
    
    // Determina il titolo in base alla situazione
    let titolo = ' Piatti in evidenza';
    if (user && user.ruolo === CONFIG.ROLES.CLIENTE && user.preferenze && user.preferenze.length > 0) {
        titolo = ' Consigliati per te';
    }
    
    const piattiHTML = piatti.map(piatto => `
        <div class="col-md-4 mb-3">
            <div class="card order-card h-100 shadow-sm">
                <img src="${escapeHtml(piatto.strMealThumb || piatto.immagine || 'https://via.placeholder.com/500x300?text=No+Image')}" 
                     class="card-img-top" 
                     alt="${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}"
                     style="height: 200px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <span class="badge bg-primary text-white mb-2 align-self-start">${escapeHtml(piatto.strCategory || piatto.categoria || 'Altro')}</span>
                    <h5 class="card-title">${escapeHtml(piatto.strMeal || piatto.nome || 'Piatto')}</h5>
                    <p class="card-text small mb-2">
                        <i class="bi bi-shop"></i> <span class="colore-arancione">${escapeHtml(piatto.nomeRistorante || 'N/D')}</span>
                    </p>
                    ${piatto.ingredients && piatto.ingredients.length > 0 ? `
                        <p class="card-text">
                            ${escapeHtml(piatto.ingredients.slice(0, 3).join(', '))}${piatto.ingredients.length > 3 ? '...' : ''}
                        </p>
                    ` : '<p class="card-text text-muted">Ingredienti non disponibili</p>'}
                    <div class="mt-auto">
                        <a href="cliente/menu.html?restaurantId=${piatto.ristoranteId}" 
                           class="btn btn-primary w-100">
                            Ordina ora 🛒
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="card shadow p-4 bordo-arancione my-5">
            <h2 class="mb-4">${titolo}</h2>
            
            <div class="row">
                ${piattiHTML}
            </div>
            <!-- Link e suggerimenti -->
            <div class="text-center mt-4">
                <a href="cliente/ristoranti.html" class="btn btn-outline-primary btn-lg">
                    Vedi tutti i ristoranti →
                </a>
                ${user && user.ruolo === CONFIG.ROLES.CLIENTE ? `
                    <p class="text-muted mb-3 mt-3">
                        <i class="bi bi-gear"></i> 
                        Personalizza le tue preferenze nel 
                        <a href="cliente/profilo.html" class="text-decoration-none colore-arancione ">profilo</a>
                    </p>
                ` : `
                    <p class="text-muted mb-3 mt-3">
                        <i class="bi bi-person-plus"></i> 
                        <a href="login.html" class="text-decoration-none">Accedi</a> 
                        per ricevere suggerimenti personalizzati
                    </p>
                `}
            </div>
        </div>
    `;
}


function mostraPiattiStatici() {
    // fuznione di emergenza, fallback con piatti statici, se non ci sono dati dal server 
    const container = document.getElementById('piatti-in-evidenza-container');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="card shadow p-4 bordo-arancione my-5">
            <h2 class="mb-4">🍽️ Piatti in evidenza</h2>
            <div class="row">
                <div class="col-md-4 mb-3">
                    <div class="card order-card h-100">
                        <img src="img/pizza.jpg" class="card-img-top" alt="Pizza" style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <span class="badge bg-warning text-dark mb-2 align-self-start">Pizza</span>
                            <h5 class="card-title">Pizza Margherita</h5>
                            <p class="card-text">Pomodoro, mozzarella, basilico fresco.</p>
                            <div class="mt-auto">
                                <a href="cliente/ristoranti.html" class="btn btn-primary w-100">Scopri i ristoranti</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="order-card card h-100">
                        <img src="img/burger.jpg" class="card-img-top" alt="Burger" style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <span class="badge bg-warning text-dark mb-2 align-self-start">Burger</span>
                            <h5 class="card-title">Cheeseburger</h5>
                            <p class="card-text">Carne, formaggio, lattuga e pomodoro.</p>
                            <div class="mt-auto">
                                <a href="cliente/ristoranti.html" class="btn btn-primary w-100">Scopri i ristoranti</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="order-card card h-100">
                        <img src="img/pasta.jpg" class="card-img-top" alt="Pasta" style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <span class="badge bg-warning text-dark mb-2 align-self-start">Pasta</span>
                            <h5 class="card-title">Pasta al Pomodoro</h5>
                            <p class="card-text">Pasta fresca con salsa al pomodoro e basilico.</p>
                            <div class="mt-auto">
                                <a href="cliente/ristoranti.html" class="btn btn-primary w-100">Scopri i ristoranti</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="text-center mt-4">
                <a href="cliente/ristoranti.html" class="btn btn-outline-primary btn-lg">
                    Vedi tutti i ristoranti →
                </a>
            </div>
        </div>
    `;
}


// ===== AUTO-INIZIALIZZAZIONE =====

document.addEventListener('DOMContentLoaded', async () => {
    console.log(' Inizializzazione homepage...');
    await caricaPiattiInEvidenza();

    await toggleNavAccedi();
});
