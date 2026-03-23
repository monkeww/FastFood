/*
   imageUpload.js
   componente riutilizzabile per l'upload di immagini
    Supporta upload da file locale e URL.

    genera i bottoncini "🔗 URL" o "📁 File".
    genera il riquadro grafico dove ce l'anteprima dell'immagine.
    cattura il file caricato dal computer dall'utente, o la stringa incollata dall'utente nel box dell'URL.
    da qui parte la richiesta verso il Backend per salvare l'immagine. 

    poi parte la richiesta verso il backend per salvare l'immagine, che restituisce un URL da usare come src 
    dell'immagine. (uploadapi.js)
 */

//crea un widget per l'upload di immagini con supporto per URL o file locale
 
function createImageUploadWidget(options) {
    const {
        containerId, // ID del container dove inserire il widget
        currentImage = '', // URL immagine iniziale (opzionale)
        onImageSelected, // callback che riceve { type: 'url'|'file', url?, file? }
        placeholder = 'Nessuna immagine' // testo placeholder se non c'è immagine
    } = options;

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} non trovato`);
        return null;
    }

    let selectedImageUrl = currentImage;
    let selectedFile = null;
    let uploadType = currentImage ? 'url' : null; // 'url' o 'file'

    // HTML del widget
    container.innerHTML = `
        <div class="image-upload-widget">
            <!-- Preview immagine compatta -->
            <div class="mb-2">
                <img id="${containerId}-preview" 
                     src="${currentImage || 'https://via.placeholder.com/200x150?text=Nessuna+Immagine'}" 
                     alt="Preview" 
                     class="img-thumbnail"
                     style="max-width: 100%; height: 120px; object-fit: cover;">
            </div>

            <!-- Opzioni di upload -->
            <div class="btn-group w-100 mb-2" role="group">
                <input type="radio" class="btn-check" name="${containerId}-uploadType" id="${containerId}-url" value="url" ${uploadType === 'url' ? 'checked' : ''}>
                <label class="btn btn-outline-primary btn-sm" for="${containerId}-url">🔗 URL</label>
                
                <input type="radio" class="btn-check" name="${containerId}-uploadType" id="${containerId}-file" value="file" ${uploadType === 'file' ? 'checked' : ''}>
                <label class="btn btn-outline-primary btn-sm" for="${containerId}-file">📁 File</label>
            </div>

            <!-- Input URL -->
            <div id="${containerId}-urlSection" style="display: ${uploadType === 'url' ? 'block' : 'none'}">
                <input type="url" 
                       class="form-control form-control-sm mb-2" 
                       id="${containerId}-urlInput" 
                       placeholder="https://esempio.com/img.jpg"
                       value="${uploadType === 'url' ? currentImage : ''}">
                <button type="button" class="btn btn-primary btn-sm w-100" id="${containerId}-urlBtn">
                    Carica da URL
                </button>
            </div>

            <!-- Input File -->
            <div id="${containerId}-fileSection" style="display: ${uploadType === 'file' ? 'block' : 'none'}">
                <input type="file" 
                       class="form-control form-control-sm" 
                       id="${containerId}-fileInput"
                       accept="image/*">
                <small class="text-muted d-block">Max 5MB</small>
            </div>

            <!-- Messaggio di stato -->
            <div id="${containerId}-status" class="alert alert-sm mt-2" style="display: none; padding: 0.25rem 0.5rem; font-size: 0.875rem;"></div>
        </div>
    `;

    // elementi DOM
    const preview = document.getElementById(`${containerId}-preview`);
    const urlSection = document.getElementById(`${containerId}-urlSection`);
    const fileSection = document.getElementById(`${containerId}-fileSection`);
    const urlInput = document.getElementById(`${containerId}-urlInput`);
    const fileInput = document.getElementById(`${containerId}-fileInput`);
    const urlBtn = document.getElementById(`${containerId}-urlBtn`);
    const statusDiv = document.getElementById(`${containerId}-status`);
    const radioUrl = document.getElementById(`${containerId}-url`);
    const radioFile = document.getElementById(`${containerId}-file`);

    // funzione per mostrare status
    function showStatus(message, type = 'info') {
        statusDiv.className = `alert alert-${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // cambio metodo upload e visualizzazione campi
    radioUrl.addEventListener('change', () => {
        urlSection.style.display = 'block';
        fileSection.style.display = 'none';
        uploadType = 'url';
    });

    radioFile.addEventListener('change', () => {
        urlSection.style.display = 'none';
        fileSection.style.display = 'block';
        uploadType = 'file';
    });

    // funzione verifica se sembra un URL di immagine per estensione
    function isLikelyImageUrl(rawUrl) {
        if (!rawUrl) return false;
        
        // convertiamo in minuscolo (così accetta anche .JPG, .PNG)
        const urlMinuscolo = rawUrl.toLowerCase();
        
        // rimuoviamo eventuali parametri alla fine dell'URL (es: ?v=123)
        const urlSenzaParametri = urlMinuscolo.split('?')[0];
        
        // ccontrolliamo se finisce con una delle estensioni di immagine
        const estensioniImmagine = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp'];
        
        return estensioniImmagine.some(estensione => urlSenzaParametri.endsWith(estensione));
    }

    // helper: tenta caricamento effettivo dell'immagine
    function verifyImageByLoading(rawUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            // se non si carica entro 6s consideriamo fallimento
            const timer = setTimeout(() => {
                img.src = '';// forza stop 
                resolve(false);
            }, 6000);
            //
            img.onload = () => { clearTimeout(timer); resolve(true); };
            img.onerror = () => { clearTimeout(timer); resolve(false); };
            img.src = rawUrl;
        });
    }

    // carica da URL con validazioni aggiuntive
    urlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();

        if (!url) {
            showStatus('Inserisci un URL', 'warning');
            return;
        }

        let parsed;
        try {
            parsed = new URL(url);
        } catch (e) {
            showStatus('URL non valido', 'danger');
            return;
        }

        // avviso se non smebra un file immagine
        const looksImage = isLikelyImageUrl(url);
        if (!looksImage) {
            showStatus('L\'URL sembra una pagina. Serve l\'indirizzo diretto del file immagine (termina con .jpg/.png...)', 'warning');
            // continuiamo comunque a provare il caricamento siccome alcuni non espongono estensione
        }

        showStatus('Verifica caricamento immagine...', 'info');
        const ok = await verifyImageByLoading(url);
        if (!ok) {
            showStatus('L\'URL non punta a un\'immagine caricabile. Copia il link diretto dell\'immagine.', 'danger');
            return;
        }

        // se arriviamo qui l'immagine è caricabile
        preview.src = url;
        selectedImageUrl = url;
        selectedFile = null;
        showStatus('Immagine validata da URL', looksImage ? 'success' : 'info');

        if (onImageSelected) {
            onImageSelected({ type: 'url', url });
        }
    });

    // carica da file
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        if (!file) return;

        // valida tipo
        if (!file.type.startsWith('image/')) {
            showStatus('Seleziona un file immagine', 'danger');
            fileInput.value = '';
            return;
        }

        // valida dimensione (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showStatus('File troppo grande. Max 5MB', 'danger');
            fileInput.value = '';
            return;
        }

        // preview locale
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            selectedFile = file;
            selectedImageUrl = null;
            
            showStatus(`File selezionato: ${file.name}`, 'success');
            
            if (onImageSelected) {
                onImageSelected({ type: 'file', file: file });
            }
        };
        reader.readAsDataURL(file);
    });

    // metodi pubblici
    /*
    // questa parte serve per permettere al codice che usa il widget di ottenere i dati dell'immagine
    // selezionata e di far partire l'upload al momento opportuno (es: quando si salva un piatto,
    // o si aggiorna un profilo...)

        in altri file veiene chiamta questa funzione per creare il widget, 
        gli altri file hanno il widget con la lista di funzioni a disposizione, che vengono returnate a lui con quella chiamata al widget
        e poi quando serve si chiama uploadToServer() per far partire l'upload vero e proprio, che restituisce un oggetto con 
         { success, imageUrl, type } da usare come src dell'immagine nel piatto o profilo.
    */
    return {
        getImageData() {
            return {
                type: uploadType,
                url: selectedImageUrl,
                file: selectedFile
            };
        },
        
        async uploadToServer() {
            // manteniamo compatibilità: se nessuna immagine selezionata lanciamo errore
            if (!selectedFile && !selectedImageUrl) {
                throw new Error('Nessuna immagine selezionata');
            }
            return await this.getFinalUploadResult();
        },

        async getFinalUploadResult() {
            // se non c'è nulla, restituisce oggetto neutro (usato da codice che vuole procedere senza immagine)
            if (!selectedFile && !selectedImageUrl) {
                return { success: true, imageUrl: '', type: 'none' };
            }

            // caso URL: non richiede upload file, ma lo validiamo lato server per coerenza
            if (selectedImageUrl) {
                try {
                    const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.UPLOAD_IMAGE}`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: selectedImageUrl })
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error || 'Errore validazione URL');
                    return data;
                } catch (err) {
                    // se il server non risponde, usa direttamente l'URL già validato dal browser
                    console.warn('Validazione server URL fallita, uso diretto:', err.message);
                    return { success: true, imageUrl: selectedImageUrl, type: 'url-fallback' };
                }
            }

            // caso file
            const formData = new FormData();
            formData.append('image', selectedFile);
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.UPLOAD_IMAGE}`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Errore upload');
            if (data.imageUrl && data.imageUrl.startsWith('/')) {
                data.imageUrl = `${CONFIG.API_BASE_URL}${data.imageUrl}`;
            }
            return data;
        },
        
        setImage(url) {
            preview.src = url;
            selectedImageUrl = url;
            selectedFile = null;
            uploadType = 'url';
            radioUrl.checked = true;
            urlInput.value = url;
            urlSection.style.display = 'block';
            fileSection.style.display = 'none';
        },
        
        reset() {
            preview.src = 'https://via.placeholder.com/300x200?text=Nessuna+Immagine';
            selectedImageUrl = null;
            selectedFile = null;
            uploadType = null;
            urlInput.value = '';
            fileInput.value = '';
            radioUrl.checked = false;
            radioFile.checked = false;
        }
    };
}

//funzione helper per fare upload diretto (senza widget)

async function uploadImage(imageSource) {
    // se è una stringa (URL), restituiscila direttamente
    if (typeof imageSource === 'string') {
        return imageSource;
    }

    // se è un File, caricalo sul server
    if (imageSource instanceof File) {
        const formData = new FormData();
        formData.append('image', imageSource);

        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.UPLOAD_IMAGE}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Errore upload');
        }

        // restituisci l'URL completo
        return `${CONFIG.API_BASE_URL}${data.imageUrl}`;
    }

    throw new Error('Tipo immagine non supportato');
}
