/*
  uploadAPI.js
  gestisce l'upload delle immagini (piatti personalizzati e profilo ristorante)
 Supporta upload da file locale e URL
    Validazione tipi file (JPG, PNG, GIF, WEBP)
    Limite 5MB per file
    Generazione nomi univoci
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { autenticaToken } = require('../utils/jwt');

// crea la cartella uploads se non esiste
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// configurazione storage per multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Genera nome file unico: timestamp + nome originale
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

// filtro per accettare solo immagini
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo file non supportato. Usa: JPG, PNG, GIF o WEBP'), false);
    }
};

// configurazione multer : intercetta le richieste http con file multipart/form-data,
const upload = multer({
    storage: storage, //dove salvare i file (in uploads)
    limits: {
        fileSize: 5 * 1024 * 1024 // max 5MB
    },
    fileFilter: fileFilter //funzione per filtrare i tipi di file accettati
});

/**
 * POST /upload/image
 * Upload di un'immagine (file o URL)
 * Body: { imageUrl: string } OPPURE FormData con file
 */
router.post('/upload/image', autenticaToken, upload.single('image'), async (req, res) => {
    try {
       
        console.log('Upload image - body keys:', Object.keys(req.body), 'file presente?', !!req.file);

        // normalizza eventuale campo imageUrl con trim e conv a stringa
        let rawUrl = req.body.imageUrl ? String(req.body.imageUrl).trim() : '';

        //2 CASI: DA URL O DA FILE
        // CASO 1: da url

        if (rawUrl) {
            // se l'utente ha inserito un path relativo /uploads/... lo convertiamo in assoluto
            if (rawUrl.startsWith('/uploads/')) {
                rawUrl = `${process.env.BASE_URL || 'http://localhost:3000'}${rawUrl}`;
            }

                // richiede protocollo http/https (versione leggibile senza regex)
                //controllo che l'url inizi con http:// o https:// 
                const normalizedUrl = rawUrl.toLowerCase();
                const urlIniziaCorrettamente =
                    normalizedUrl.startsWith('http://') ||
                    normalizedUrl.startsWith('https://');

                if (!urlIniziaCorrettamente) {
                return res.status(400).json({
                    success: false,
                    error: 'L\'URL deve iniziare con http:// o https://'
                });
            }

            
            try {
                new URL(rawUrl);
            } catch (e) {
                return res.status(400).json({ success: false, error: 'Formato URL non valido' });
            }

            console.log('URL accettato:', rawUrl);
            return res.json({ success: true, imageUrl: rawUrl, type: 'url' });
        }

        // CASO 2 upload da file
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            console.log('File salvato:', req.file.filename, 'size:', req.file.size);
            return res.json({
                success: true,
                imageUrl,
                type: 'file',
                filename: req.file.filename,
                size: req.file.size
            });
        }

        
        return res.status(400).json({ success: false, error: 'Fornisci un file immagine o un URL' });
    } catch (error) {
        console.error('❌ Errore upload immagine:', error);
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File troppo grande. Max 5MB' });
        }
        res.status(500).json({ success: false, error: error.message || 'Errore durante l\'upload dell\'immagine' });
    }
});


router.delete('/upload/image/:filename', autenticaToken, async (req, res) => {
    try {
        const { filename } = req.params;
        
        // validazione: solo file caricati localmente
        // per sicurezza, accettiamo solo file che iniziano con 'img-' (che è   generata da multer)
        if (!filename.startsWith('img-')) {
            return res.status(400).json({
                success: false,
                error: 'Nome file non valido'
            });
        }
        
        const filePath = path.join(uploadsDir, filename);
        
        // verifica che il file esista con fs che vuol dire che è stato caricato localmente, 
        // altrimenti non possiamo eliminarlo.( i file se caricati da url esterni bengono salvati locally )
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File non trovato'
            });
        }
        
        // elimina il file con fs.unlinkSync, che è una funzione sincrona che rimuove il file dal filesystem. 
        fs.unlinkSync(filePath);
        
        res.json({
            success: true,
            message: 'Immagine eliminata con successo'
        });
        
    } catch (error) {
        console.error('Errore eliminazione immagine:', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante l\'eliminazione dell\'immagine'
        });
    }
});

module.exports = router;
