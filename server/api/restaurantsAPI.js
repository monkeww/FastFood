const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import configurazione condivisa
const { ROLES } = require('../../client/js/config');

const User = require('../models/userModel');

// ========== LISTA RISTORANTI accessibile a TUTTI anche senza login) ==========
/*
    esempi
    /restaurants?search=pizza
    /restaurants?category=italian
    /restaurants?search=sushi&category=japanese
*/
router.get('/restaurants', async (req, res) => {
    try {
        const { search, category } = req.query;
 
        const filtro = { ruolo: ROLES.RISTORANTE };

        // ricerche per nome e categoria sono opzionali, se presenti allora:
        // typeof restitusce il tipo della var
        //=== è l operatore di confronto stretto (identico). verifica se due cose sono uguali nel valore e nel tipo. == controlla solo il valore
        if (typeof search === 'string' && search.trim() !== '') { //trim toglie gli spazi a fine e inizio stringa, controllando che nonsia vuota
            filtro.nomeRistorante = { $regex: new RegExp(search, 'i') };
        }
    
        if (typeof category === 'string' && category.trim() !== '') {
            filtro.categoria = { $regex: new RegExp(category, 'i') };
        }
        // Trova tutti i ristoranti
        const ristoranti = await User.find(filtro)
            // AGGIUNTO campo 'immagine' per mostrare foto profilo ristorante lato cliente
            .select('nomeRistorante categoria indirizzo descrizione telefono immagine')
            .sort({ nomeRistorante: 1 }); // ordine alfabetico crescente = 1, decrescente = -1  

        res.json({ 
            success: true,
            count: ristoranti.length,
            ristoranti: ristoranti.map(rist => ({       //.map trasforma ogni elemento dell'array, pulisce e invia solo i campi necessari
                id: rist._id,
                nome: rist.nomeRistorante,
                categoria: rist.categoria || 'Non specificata',
                indirizzo: rist.indirizzo || 'Non specificato',
                descrizione: rist.descrizione || '',
                telefono: rist.telefono || 'Non disponibile',
                immagine: rist.immagine || '' // può essere vuoto, il client gestisce placeholder
            }))
        });

    } catch (err) {
        console.error('❌ Errore recupero ristoranti:', err);
        res.status(500).json({ success: false, error: 'Errore recupero ristoranti' });
    }
});

//per ottenere i dettagli di ristoranti
router.get('/restaurants/:id', async (req, res) => {
    try {
        const { id } = req.params; //const id = req.params.id;

        // Valida ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID ristorante non valido' 
            });
        }
        
        const ristorante = await User.findById(id)
            .select('nomeRistorante categoria indirizzo descrizione telefono partitaIVA');

        if (!ristorante) {
            return res.status(404).json({ success: false, message: 'Ristorante non trovato' });
        }

        
        if (ristorante.ruolo !== ROLES.RISTORANTE) {
            return res.status(400).json({  success: false, message: 'Questo utente non è un ristorante'  });
        }

        res.json({ 
            success: true,
            ristorante: {       //senza .map, è un metodo di array. qui lavoro conun elemento solo e nons erve 
                id: ristorante._id, 
                nome: ristorante.nomeRistorante,
                categoria: ristorante.categoria || 'Non specificata',
                indirizzo: ristorante.indirizzo || 'Non specificato',
                descrizione: ristorante.descrizione || '',
                telefono: ristorante.telefono || 'Non disponibile',
                partitaIVA: ristorante.partitaIVA
            }
        });

    } catch (err) {
        console.error('❌ Errore recupero dettagli ristorante:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero dettagli ristorante' 
        });
    }
});

router.get('/restaurants-categories', async (req, res) => {
    try {
        // trova tutte le categorie uniche dei ristoranti
        const categorie = await User.distinct('categoria', { ruolo: ROLES.RISTORANTE });

        // filtra eventuali valori null o vuoti, crea nuovo array 
        //prima controllo che sia stringa, altrimenti trim non funziona
        const categoriePulite = categorie.filter(cat => typeof cat === 'string' && cat.trim() !== '');

        res.json({ 
            success: true,
            count: categoriePulite.length,
            categorie: categoriePulite.sort()
        });

    } catch (err) {
        console.error('❌ Errore recupero categorie ristoranti:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero categorie ristoranti' 
        });
    }
});

module.exports = router;
