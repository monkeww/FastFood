/*
  caricaProfiloCliente / caricaProfiloRistorante
  gestiscono il caricamento della dashboard del profilo per il rispettivo ruolo, 
  scaricando eventualmente i dati aggiuntivi (come la lista ordini per il cliente).

  renderDatiUtente / renderProfiloCliente / renderProfiloRistorante
  funzioni di utilità per creare a schermo il riquadro grafico (HTML) con le info 
  anagrafiche dell'utente loggato, con differenze specifiche in base al ruolo.

  renderOrdiniProfilo
  Popola la tabella degli ordini recenti mostrata all'interno del profilo Cliente.

  modificaDati / eliminaAccount
  gestiscono gli eventi di interazione sui pulsanti di modifica info personali 
  o cancellazione dell'utente dal db.
  
  inizializzazione
  al caricamento della pagina (DOMContentLoaded) la pagina verifica il login e sceglie
  automaticamente se mostrare l'interfaccia Cliente o Ristorante.
*/
// gestione pagina profilo cliente

// carica dati utente e ordini
// funzione specifica per caricare profilo CLIENTE (riceve user da getUser, non fa chiamata API duplicata)
async function caricaProfiloCliente(user) {
    // renderizza dati utente
    renderDatiUtente(user);
    
    showLoading(true);
    
    // carica ordini solo per i clienti, siccome c'è una sezione ordini nei profili clienti
    const ordiniResult = await apiGet(CONFIG.ENDPOINTS.ORDERS_MINE); //prende gli ordini con l'api dedicata
    
    showLoading(false);
    
    if (ordiniResult.success) {
        renderOrdiniProfilo(ordiniResult.data.ordini);
    } else {
        showToast('Errore nel caricamento ordini', 'error');
    }
}

// funzione specifica per caricare profilo RISTORANTE (riceve user da getUser, non fa chiamata API duplicata)
async function caricaProfiloRistorante(user) {
    // renderizza solo dati utente, i ristoranti non hanno sezione ordini nel profilo
    renderDatiUtente(user);
}

// dispatcher, dedice quale render usare in base al ruolo, se renderizzare profilo cliente o ristorante 
function renderDatiUtente(user) {
    // cerca prima il container dedicato nella pagina per il profilo, poi i fallback
    let container = document.getElementById('profilo-container');
    
    if (!container) {
        // fallback per il layout cliente, guarda se esiste una card in una col-md-4 (layout cliente) o col-md-12 (layout ristorante)
        //se non trova il container specifico, cerca in questi due layout comuni, altrimenti return niente
        container = document.querySelector('.col-md-4 .card') || document.querySelector('.col-md-12 .card');
    }
    
    if (!container) return;
    
    // renderizza in base al ruolo, chiamano le funzioni apposite.
    if (user.ruolo === CONFIG.ROLES.CLIENTE) {
        renderProfiloCliente(container, user);
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        renderProfiloRistorante(container, user);
    }
}

// renderizza profilo cliente, chiamata da renderDatiUtente, a sua volta chiamata da caricaProfilo
function renderProfiloCliente(container, user) {
    //questo comando sostituisce il contenuto del container con la nuova stringa html, usando le backticks
    //${escapeHtml(...)} funzione sicurezza: mpedisce attacchi xss croos site scripting.
    //ovvero se l''utente si loggasse con nome tipo: <script>alert('hackerato!')</script>, lo trasfoorma in testo innocuo

    //senza sarebbe: ${user.nome} ${user.cognome || ''}

    //text-muted rende il testo leggermente più chiaro di nero.
    container.innerHTML = `
        <div class="p-3">
            <h4 class="mb-4">👤 Il tuo profilo</h4>
            <div class="mb-3">
                <strong>Nome Completo:</strong><br>
                <span class="text-muted">${escapeHtml(user.nome)} ${escapeHtml(user.cognome || '')}</span>
            </div>
            <div class="mb-3">
                <strong>Email:</strong><br>
                <span class="text-muted">${escapeHtml(user.email)}</span>
            </div>
            <div class="mb-3">
                <strong>Telefono:</strong><br>
                <span class="text-muted">${escapeHtml(user.telefono || 'Non specificato')}</span>
            </div>
            <div class="mb-3">
                <strong>Tipo Account:</strong><br>
                <span class="badge bg-success">🛍️ Cliente</span>
            </div>
            <div class="mb-4">
                <strong>Preferenze:</strong><br>
                <div class="mt-2">
                    ${user.preferenze && user.preferenze.length > 0 
                        ? user.preferenze.map(pref => `<span class="badge bg-light text-dark me-1 mb-1"> ${escapeHtml(pref)}</span>`).join('')
                        : '<span class="text-muted">Nessuna preferenza impostata</span>'
                    }
                </div>
            </div>
            <hr>
            <div class="d-grid gap-2">
                <button class="btn btn-outline-primary" onclick="modificaPreferenze()">
                    🎯 Gestisci preferenze
                </button>
                <button class="btn btn-primary" onclick="modificaDati()">
                    ✏️ Modifica dati
                </button>
                <button class="btn btn-outline-arancione" onclick="logout()">
                    🚪 Logout
                </button>
                <button class="btn btn-danger" onclick="eliminaAccount()">
                    🗑️ Elimina account
                </button>
            </div>
        </div>
    `;
}

// renderizza profilo ristorante
function renderProfiloRistorante(container, user) {
    container.innerHTML = `
        <div class="row">
            <!-- Informazioni Ristorante -->
            <div class="col-md-6 mb-4">
                <h5 class="mb-3">🍴 Informazioni Ristorante</h5>
                <div class="p-3 bg-light rounded">
                    <p><strong>Nome Ristorante:</strong><br>
                       <span class="text-muted">${escapeHtml(user.nomeRistorante || 'Non specificato')}</span>
                    </p>
                    <p><strong>Partita IVA:</strong><br>
                       <span class="text-muted">${escapeHtml(user.partitaIVA || 'Non specificata')}</span>
                    </p>
                    <p class="mb-0"><strong>Indirizzo:</strong><br>
                       <span class="text-muted">${escapeHtml(user.indirizzo || 'Non specificato')}</span>
                    </p>
                </div>
            </div>

            <!-- Contatti -->
            <div class="col-md-6 mb-4">
                <h5 class="mb-3">📞 Contatti</h5>
                <div class="p-3 bg-light rounded">
                    <p><strong>Email:</strong><br>
                       <span class="text-muted">${escapeHtml(user.email)}</span>
                    </p>
                    <p><strong>Telefono:</strong><br>
                       <span class="text-muted">${escapeHtml(user.telefono || 'Non specificato')}</span>
                    </p>
                    <p class="mb-0"><strong>Tipo Account:</strong><br>
                       <span class="badge bg-warning text-dark">🏪 Ristorante</span>
                    </p>
                </div>
            </div>

            <!-- immagine Ristorante -->
            <div class="col-md-12 mb-4">
                <h5 class="mb-3">🖼️ Immagine Ristorante</h5>
                <div class="p-3 bg-light rounded text-center">
                    ${user.immagine 
                        ? `<img src="${escapeHtml(user.immagine)}" alt="Immagine Ristorante" class="img-fluid rounded shadow-sm" style="max-width: 400px; max-height: 250px; object-fit: cover;">
                           <p class="mt-2 text-muted small">${escapeHtml(user.immagine)}</p>`
                        : `<div class="alert alert-warning mb-0">
                               <i class="bi bi-image"></i> Nessuna immagine caricata
                           </div>`
                    }
                    <button class="btn btn-primary mt-3" onclick="apriModalImmagineProfilo()">
                        ${user.immagine ? '✏️ Modifica Immagine' : '➕ Aggiungi Immagine'}
                    </button>
                </div>
            </div>

            <!-- azioni -->
            <div class="col-md-12">
                <h5 class="mb-3">⚙️ Gestione Account</h5>
                <div class="p-3 bg-light rounded text-center">
                    <button class="btn btn-primary btn-lg mx-2 mb-2" onclick="modificaDati()">
                        ✏️ Modifica dati
                    </button>
                    <button class="btn btn-outline-arancione btn-lg mx-2 mb-2" onclick="logout()">
                        🚪 Logout
                    </button>
                    <button class="btn btn-danger btn-lg mx-2 mb-2" onclick="eliminaAccount()">
                        🗑️ Elimina account
                    </button>
                </div>
            </div>
        </div>
    `;
}

// renderizza tabella ordini nel profilo tbody è  corpo dell atabella, per raggruppare il contenuto rpincipale
// utilizzo assieme a thead, tbody (ha le righe e colonne dentro)e tfoot
function renderOrdiniProfilo(ordini) {
    //seleziona elemento tbody gia presente nel html, chiamato 'ordiniTable'
    const tbody = document.getElementById('ordiniTable');
    const btnVediTutti = document.getElementById('btn-vedi-tutti-ordini');
    
    if (!tbody) return;
    
    
    // mostra/nascondi bottone "Vedi tutti" se ci sono ordini
    if (btnVediTutti) {
        //btnVediTutti.style.display = (ordini && ordini.length > 0) ? 'inline-block' : 'none';
        if (ordini && ordini.length > 0) {
            btnVediTutti.style.display = 'block';
        } else {
            btnVediTutti.style.display = 'none';
        }
    }
    
    if (!ordini || ordini.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    Nessun ordine effettuato
                </td>
            </tr>
        `;
        return;
    }
    
    
    // mostra solo gli ultimi 5 ordini
    const ordiniRecenti = ordini.slice(0, 5);
    
    //riempie il tbody con le righe degli ordini recenti, rimappando l'array ordiniRecenti
    //.join('') trasforma array di elementi in stringa unica, usando come separatore il nulla in questo caso ''
    // poiche map ritorna un array di stringhe, ma innerHTML vuole una singola stringa. 

    //<tr>...</tr> , <tr>...</tr> ----> <tr>...</tr><tr>...</tr>
    tbody.innerHTML = ordiniRecenti.map((ordine, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${formatDate(ordine.createdAt)}</td>
            <td>${escapeHtml(ordine.nomeRistorante || 'N/D')}</td>
            <td>${formatPrice(ordine.totale)}</td>
            <td>${getStatusBadge(ordine.stato)}</td>
        </tr>
    `).join('');
}

// Funzione per modificare dati
/*//EMAIL E P.IVA NON MODIFICABILI
 identificatore univoco: L'email è usata come username per il login.
 Ordini collegati: Gli ordini sono collegati all'email, cambiarla creerebbe confusione.
 LA maggior parte dei siti NON permette di cambiare email (o richiede verifica via OTP, o di riinserire la password), anche per motivi di sicurezza sulla persona che sta eseguendo ciò.
 la partita iva è unidentificativo fiscale ufficiale, realisticamente non dovrebbe essere modificabile dopo la creazione dell'account, anche perchè
 un altra partita iva = un altra persona giuridica di ristorante (un altra partita iva)

*/
async function modificaDati() {
    // Ottieni dati utente correnti
    const userResult = await apiGet(CONFIG.ENDPOINTS.PROFILE);
    
    if (!userResult.success) {
        showToast('Errore nel caricamento dati', 'error');
        return;
    }
    
    const user = userResult.data.user;
    
    // crea il modal dinamicamente
    const modalHtml = `
        <div class="modal fade modal-modifica-dati" id="modalModificaDati" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">✏️ Modifica Dati</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="formModificaDati">
                            <div class="row g-3">
                                ${user.ruolo === CONFIG.ROLES.CLIENTE ? `
                                    <!-- Campi Cliente -->
                                    <div class="col-md-6">
                                        <label class="form-label">Nome *</label>
                                        <input type="text" class="form-control" id="editNome" 
                                               value="${escapeHtml(user.nome)}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Cognome</label>
                                        <input type="text" class="form-control" id="editCognome" 
                                               value="${escapeHtml(user.cognome || '')}">
                                    </div>
                                ` : `
                                    <!-- Campi Ristorante -->
                                    <div class="col-md-6">
                                        <label class="form-label">Nome Ristorante *</label>
                                        <input type="text" class="form-control" id="editNomeRistorante" 
                                               value="${escapeHtml(user.nomeRistorante || '')}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Indirizzo</label>
                                        <input type="text" class="form-control" id="editIndirizzo" 
                                               value="${escapeHtml(user.indirizzo || '')}">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Partita IVA (non modificabile)</label>
                                        <input type="text" class="form-control bg-light" id="editPartitaIVA" 
                                               value="${escapeHtml(user.partitaIVA || '')}" disabled>
                                        <small class="text-muted">La Partita IVA non può essere modificata</small>
                                    </div>
                                `}
                                <!-- Campi comuni -->
                                <div class="col-md-6">
                                    <label class="form-label">Email (non modificabile)</label>
                                    <input type="email" class="form-control bg-light" id="editEmail" 
                                           value="${escapeHtml(user.email)}" disabled>
                                    <small class="text-muted">L'email non può essere modificata</small>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Telefono</label>
                                    <input type="tel" class="form-control" id="editTelefono" 
                                           value="${escapeHtml(user.telefono || '')}">
                                </div>
                                <div class="col-12">
                                    <hr class="my-2">
                                </div>
                                <!-- Sezione Password Collassabile -->
                                <div class="col-12">
                                    <button type="button" class="btn btn-sm btn-outline-primary mb-2" data-bs-toggle="collapse" data-bs-target="#collapsePassword" aria-expanded="false" aria-controls="collapsePassword">
                                        🔐 Modifica Password
                                    </button>
                                    <div class="collapse" id="collapsePassword">
                                        <div class="row g-3">
                                            <div class="col-md-6">
                                                <label class="form-label">Nuova Password</label>
                                                <input type="password" class="form-control" id="editPassword" 
                                                       placeholder="Inserisci nuova password">
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Conferma Password</label>
                                                <input type="password" class="form-control" id="editPasswordConfirm" 
                                                       placeholder="Conferma nuova password">
                                            </div>
                                            <div class="col-12">
                                                <small class="text-muted">Lascia vuoto per non modificare la password.</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                        <button type="button" class="btn btn-primary" onclick="salvaDatiModificati()">
                            💾 Salva Modifiche
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // rimuovi modal precedente se esiste
    const oldModal = document.getElementById('modalModificaDati');
    if (oldModal) {
        oldModal.remove();
    }
    
    //aggiungi modal al body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    //mostra il modal
    const modal = new bootstrap.Modal(document.getElementById('modalModificaDati'));
    modal.show();
}

//funzione per salvare i dati modificati
async function salvaDatiModificati() {
    const form = document.getElementById('formModificaDati');
    
    // validazione form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    //ottieni dati utente per sapere il ruolo
    const userResult = await apiGet(CONFIG.ENDPOINTS.PROFILE);
    if (!userResult.success) {
        showToast('Errore nel caricamento dati', 'error');
        return;
    }
    
    const user = userResult.data.user;
    
    //prepara dati da inviare (SOLO campi permessi dal backend)
    const datiAggiornati = {
        telefono: document.getElementById('editTelefono').value || null
    };
    
    //aggiungi campi specifici per ruolo (secondo allowedFields del backend)
    if (user.ruolo === CONFIG.ROLES.CLIENTE) {
        // allowedFields: ['nome', 'cognome', 'telefono', 'preferenze', 'password', 'metodiPagamento']
        datiAggiornati.nome = document.getElementById('editNome').value;
        datiAggiornati.cognome = document.getElementById('editCognome').value || null;
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        // allowedFields: ['nomeRistorante', 'indirizzo', 'categoria', 'descrizione', 'telefono', 'password']
        datiAggiornati.nomeRistorante = document.getElementById('editNomeRistorante').value;
        datiAggiornati.indirizzo = document.getElementById('editIndirizzo').value || null;
        // partitaIVA NON è permessa (non è negli allowedFields ) 
    }
    
    // gestione password
    const nuovaPassword = document.getElementById('editPassword').value;
    const confermaPassword = document.getElementById('editPasswordConfirm').value;
    
    if (nuovaPassword || confermaPassword) {
        if (nuovaPassword !== confermaPassword) {
            showToast('Le password non coincidono', 'error');
            return;
        }
        if (nuovaPassword.length < 6) {
            showToast('La password deve essere di almeno 6 caratteri', 'error');
            return;
        }
        datiAggiornati.password = nuovaPassword;
    }
    
    //mostra loading
    showLoading(true);
    
    console.log('📤 Invio dati:', datiAggiornati);
    
    //invia richiesta di aggiornamento
    const result = await apiPatch(CONFIG.ENDPOINTS.UPDATE_USER, datiAggiornati);
    
    console.log('📥 Risposta server:', result);
    
    showLoading(false);
    
    if (result.success) {
        showToast('Dati aggiornati con successo! ✅', 'success');
        
        //chiudi modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificaDati'));
        modal.hide();
        
        //ricarica i dati del profilo
        await caricaProfilo();
    } else {
        showToast(result.error || 'Errore nell\'aggiornamento dei dati', 'error');
    }
}

//funzione per eliminare account
async function eliminaAccount() {
    if (!confirm('⚠️ Sei sicuro di voler eliminare il tuo account?')) {
        return;
    }
    
    if (!confirm('Confermi definitivamente? Tutti i tuoi dati verranno cancellati.')) {
        return;
    }
    
    showLoading(true);
    
    const result = await apiDelete(CONFIG.ENDPOINTS.DELETE_USER);
    
    showLoading(false);
    
    if (result.success) {
        showToast('Account eliminato con successo', 'success');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
    } else {
        showToast(result.error || 'Errore eliminazione account', 'error');
    }
}

//funzione per gestire le preferenze del cliente
async function modificaPreferenze() {
    try {
        //carica categorie disponibili
        const categorieResult = await apiGet(CONFIG.ENDPOINTS.MEALS_CATEGORIES);
        if (!categorieResult.success) {
            showToast('Errore nel caricamento categorie', 'error');
            return;
        }
        const categorie = categorieResult.data.categories || [];
        
        //carica preferenze attuali dell'utente dal profilo
        const userResult = await apiGet(CONFIG.ENDPOINTS.PROFILE);
        if (!userResult.success) {
            showToast('Errore nel caricamento dati utente', 'error');
            return;
        }
        const preferenzeAttuali = userResult.data.user.preferenze || [];
        
        // crea HTML del modal con checkbox per ogni categoria, pre-selezionando quelle attuali 
        const modalHtml = `
            <div class="modal fade modal-modifica-dati" id="modalModificaPreferenze" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">🎯 Le tue preferenze culinarie</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted mb-3">
                                Seleziona le categorie che preferisci per ricevere suggerimenti personalizzati:
                            </p>
                            <div id="checkboxPreferenze">
                                ${categorie.map(categoria => `
                                    <div class="form-check mb-2">
                                        <input class="form-check-input" type="checkbox" 
                                               value="${escapeHtml(categoria)}" 
                                               id="pref_${categoria.replace(/\s+/g, '_')}"
                                               ${preferenzeAttuali.includes(categoria) ? 'checked' : ''}>
                                        <label class="form-check-label" for="pref_${categoria.replace(/\s+/g, '_')}">
                                            🍽️ ${escapeHtml(categoria)}
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                Annulla
                            </button>
                            <button type="button" class="btn btn-primary" onclick="salvaPreferenze()">
                                💾 Salva Preferenze
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // rimuovi modal precedente se esiste
        const oldModal = document.getElementById('modalModificaPreferenze');
        if (oldModal) {
            oldModal.remove();
        }

        // aggiungi modal e mostralo
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('modalModificaPreferenze'));
        modal.show();
        
    } catch (error) {
        console.error('Errore in modificaPreferenze:', error);
        showToast('Errore nel caricamento preferenze', 'error');
    }
}

// Funzione per salvare le preferenze selezionate
async function salvaPreferenze() {
    try {
        // Ottieni tutte le checkbox selezionate
        const checkboxes = document.querySelectorAll('#checkboxPreferenze input[type="checkbox"]:checked');
        const preferenzeSelezionate = Array.from(checkboxes).map(cb => cb.value);
        
        console.log('📤 Salvataggio preferenze:', preferenzeSelezionate);
        
        // Mostra loading
        showLoading(true);
        
        // Invia aggiornamento al backend
        const response = await apiPatch(CONFIG.ENDPOINTS.UPDATE_USER, {
            preferenze: preferenzeSelezionate
        });
        
        showLoading(false);
        
        if (response.success) {
            
            showToast(`Preferenze aggiornate! ✅ (${preferenzeSelezionate.length} categorie selezionate)`, 'success');
            
            //chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificaPreferenze'));
            modal.hide();
            
            //ottieni dati utente aggiornati e ricarica profilo
            const userAggiornato = await getUser();
            if (userAggiornato) {
                await caricaProfiloCliente(userAggiornato);
            }
            
        } else {
            showToast(response.error || 'Errore nel salvare le preferenze', 'error');
        }
        
    } catch (error) {
        showLoading(false);
        console.error('Errore in salvaPreferenze:', error);
        showToast('Errore nel salvare le preferenze', 'error');
    }
}

//auto-inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    
    /* spostato tutto nella funzione waitAuthVerification() ------------------------------------------------------------------------- 
    const maxWait = 100; // max 10 secondi
    let attempts = 0;
    while (!document.body.classList.contains('auth-verified') && attempts < maxWait) {
        //await new Promise(resolve => setTimeout(resolve, 100));
        await delay(100); 
        attempts++;
    }
    if (!document.body.classList.contains('auth-verified')) {
        console.error('Autenticazione non verificata - stop caricamento profilo');
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
    
    // dispatcher: chiama la funzione specifica in base al ruolo (pattern come ordini.js)
    if (user.ruolo === CONFIG.ROLES.CLIENTE) {
        await caricaProfiloCliente(user);
    } else if (user.ruolo === CONFIG.ROLES.RISTORANTE) {
        await caricaProfiloRistorante(user);
    }
});

// ===== UPLOAD IMMAGINE PROFILO =====

let uploadProfiloWidget = null;

function apriModalImmagineProfilo() {
    //ottieni l'immagine corrente
    getUser().then(user => {
        //inizializza widget se non esiste
        if (!uploadProfiloWidget) {
            uploadProfiloWidget = createImageUploadWidget({
                containerId: 'uploadProfiloWidget',
                currentImage: user.immagine || '',
                placeholder: 'Immagine profilo ristorante'
            });
        } else {
            uploadProfiloWidget.setImage(user.immagine || '');
        }
        
        //apri modal
        const modal = new bootstrap.Modal(document.getElementById('modalUploadImmagineProfilo'));
        modal.show();
    });
}

async function salvaImmagineProfilo() {
    try {
        if (!uploadProfiloWidget) {
            showToast('Widget non inizializzato', 'error');
            return;
        }
        
        showLoading(true);
        
        // upload immagine
        console.log('Inizio upload immagine...');
        const uploadResult = await uploadProfiloWidget.uploadToServer();
        console.log('Upload completato:', uploadResult);
        
        //aggiorna profilo con nuova immagine
        console.log('Aggiornamento profilo con URL:', uploadResult.imageUrl);
        const result = await apiPatch(CONFIG.ENDPOINTS.UPDATE_USER, {
            immagine: uploadResult.imageUrl
        });
        console.log(' Risposta aggiornamento:', result);
        
        showLoading(false);
        
        if (result.success) {
            showToast('✅ Immagine profilo aggiornata!', 'success');
            
            // chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalUploadImmagineProfilo'));
            if (modal) modal.hide();
            
            // ricarica la pagina per mostrare l'immagine aggiornata
            console.log('🔄 Ricaricamento pagina tra 1 secondo...');
            setTimeout(() => {
                console.log('🔄 Eseguo reload...');
                window.location.reload();
            }, 1000);
        } else {
            showToast(`❌ Errore: ${result.error || 'Impossibile aggiornare'}`, 'error');
        }
    } catch (error) {
        console.error('Errore salvataggio:', error);
        showLoading(false);
        showToast('❌ Errore: ' + error.message, 'error');
    }
}
