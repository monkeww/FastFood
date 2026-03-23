const express = require('express');
const router = express.Router();

// Import configurazione condivisa
const { ROLES } = require('../../client/js/config');

const User = require('../models/userModel');
const Meal = require('../models/mealModel');
const { autenticaToken, checkRistorante } = require('../utils/jwt');

async function GetMenuWithDetails(menu) { 
    const menuConDettagli = [];

    //|| significa: se la parte a sinistra è falsy (cioè undefined, null, false, 0, NaN, o stringa vuota), allora usa la parte a destra.
    for (const item of menu) {      // senza promise, 
        if (item.piattoComuneId) {
            const mealDetails = await Meal.findOne({ idMeal: item.piattoComuneId });
            menuConDettagli.push({
                _id: item._id,
                piattoComuneId: item.piattoComuneId,
                piattoPersonalizzato: false,
                strMeal: mealDetails?.strMeal || 'Non specificato',
                strCategory: mealDetails?.strCategory || 'Non specificato', 
                strArea: mealDetails?.strArea || 'Non specificato',
                strMealThumb: mealDetails?.strMealThumb || '',
                ingredients: mealDetails?.ingredients || [],
                prezzo: item.prezzo
            });
        } else {
            menuConDettagli.push({
                _id: item._id,
                piattoPersonalizzato: true,
                strMeal: item.strMeal,
                strCategory: item.strCategory,
                strMealThumb: item.strMealThumb,
                ingredients: item.ingredients,
                prezzo: item.prezzo
            });
        }
    }

    return menuConDettagli;
}            

//========== MENU DEL RISTORANTE solo per ristoranti loggati ==========

// ristorante vede il PROPRIO menu
router.get('/menu', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id; // ID dal token JWT

        // prendo nome e menu (non email etc)
        const ristorante = await User.findById(ristoranteId).select('nomeRistorante menu');

        if (!ristorante) {
            return res.status(404).json({ 
                success: false, message: 'Ristorante non trovato' });
        }

        /* =========VERSIONE CON èROMISES, piu veloce ma meno leggibile ==========================


        // popola i dettagli dei piatti comuni dal database meals
        const menuConDettagli = await Promise.all(
            ristorante.menu.map(async (item) => {
                // se è un piatto comune, prendi i dettagli da meals (db comune ) , poiche il menu nel ristorante ha solo 
                // il riferimento, non tutto il piatto
                if (item.piattoComuneId) {
                    const mealDetails = await Meal.findOne({ idMeal: item.piattoComuneId });
                    
                    return {
                        _id: item._id,
                        piattoComuneId: item.piattoComuneId,
                        piattoPersonalizzato: false,
                        strMeal: mealDetails?.strMeal || 'N/A', //?. serve a non rmpere il codice se mealdetails non esiste
                        strCategory: mealDetails?.strCategory || 'N/A', 
                        strArea: mealDetails?.strArea || 'N/A',
                        strMealThumb: mealDetails?.strMealThumb || '',
                        ingredients: mealDetails?.ingredients || [],
                        prezzo: item.prezzo
                    };
                } else {
                    // altrimenti se é un piatto personalizzato, usa i dati dal menu del ristorante
                    return {
                        _id: item._id,
                        piattoPersonalizzato: true,
                        strMeal: item.strMeal,
                        strCategory: item.strCategory,
                        strMealThumb: item.strMealThumb,
                        ingredients: item.ingredients,
                        prezzo: item.prezzo
                    };
                }
            })
        );
        */
        const menuConDettagli = await GetMenuWithDetails(ristorante.menu);

        res.json({ 
            success: true,
            ristorante: {
                id: ristorante._id,
                nome: ristorante.nomeRistorante
            },
            menu: menuConDettagli
        });

    } catch (err) {
        console.error('❌ Errore recupero menu:', err);
        res.status(500).json({ 
            success: false,  error: 'Errore recupero menu' });
    }
});

// aggiunge piatto al menu
router.post('/menu/add', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id;
        const { piattoComuneId, piattoPersonalizzato, strMeal, ingredients, strCategory, strMealThumb, prezzo } = req.body;

        //controllo prezzo obbligatorio ( di default non c'è nel db)
        if (!prezzo || prezzo <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Prezzo obbligatorio e deve essere maggiore di 0' 
            });
        }

        // trova il ristorante e poi aggiungi piatto
        const ristorante = await User.findById(ristoranteId);

        if (!ristorante) {
            return res.status(404).json({ 
                success: false,
                message: 'Ristorante non trovato' 
            });
        }

        let nuovoPiatto = {};

        // se è un piatto comune
        if (piattoComuneId && !piattoPersonalizzato) {
            // verifica che il piatto esista nel database meals
            const mealExists = await Meal.findOne({ idMeal: piattoComuneId });
            
            if (!mealExists) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Piatto comune non trovato nel database' 
                });
            }

            // verifica che non sia già nel menu
            const giaPresente = ristorante.menu.some( //.some ontrolla se almeno uno degli elementi dell'array rispetta la condizione.
                //prende ogni elemento del menu e controlla se ha piattoComuneId uguale a piattoComuneId. e .some imposta true o false 
                item => item.piattoComuneId === piattoComuneId 
            );

            /* oppure in modo piu leggibile:

               let giaPresente = false;
                for (const item of ristorante.menu) {
                    if (item.piattoComuneId === piattoComuneId) {
                        giaPresente = true;
                        break; // interrompe il ciclo appena lo trova
                    }
                } 

            */

            if (giaPresente) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Questo piatto è già presente nel menu' 
                });
            }

            nuovoPiatto = {
                piattoComuneId: piattoComuneId,
                piattoPersonalizzato: false,
                prezzo: prezzo
            };
        } 
        // Se è un piatto personalizzato
        else if (piattoPersonalizzato) {
            // validazione campi obbligatori per piatti personalizzati
            if (!strMeal || !strCategory || !ingredients || ingredients.length === 0) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Per piatti personalizzati: nome, categoria e ingredienti sono obbligatori' 
                });
            }

            nuovoPiatto = {
                piattoPersonalizzato: true,
                strMeal: strMeal,
                strCategory: strCategory,
                strMealThumb: strMealThumb || '',
                ingredients: ingredients,
                prezzo: prezzo
            };
        } else {
            return res.status(400).json({ 
                success: false,
                message: 'Specifica se è un piatto comune (piattoComuneId) o personalizzato (piattoPersonalizzato: true)' 
            });
        }

        // aggiungi il piatto al menu, passato tutti i controlli di validazione
        ristorante.menu.push(nuovoPiatto); //mongoose genera _id automaticamente
        await ristorante.save();

        res.status(201).json({ 
            success: true,
            message: 'Piatto aggiunto al menu con successo',
            //piatto: ristorante.menu[ristorante.menu.length - 1] // ultimo aggiunto
        });

    } catch (err) {
        console.error('❌ Errore aggiunta piatto:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore aggiunta piatto al menu' 
        });
    }
});

// PATCH /menu/update/:menuItemId - Modifica prezzo di un piatto
router.patch('/menu/update/:menuItemId', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id;
        const { menuItemId } = req.params;
        const { prezzo, strMeal, strCategory, ingredients, strMealThumb } = req.body;

        // Recupera il ristorante
        const ristorante = await User.findById(ristoranteId);
        if (!ristorante) {
            return res.status(404).json({ success: false, message: 'Ristorante non trovato' });
        }

        // Trova il piatto nel menu
        const piatto = ristorante.menu.id(menuItemId);
        if (!piatto) {
            return res.status(404).json({ success: false, message: 'Piatto non trovato nel menu' });
        }

        // Se è piatto comune: consentito solo aggiornare il prezzo
        if (piatto.piattoComuneId && !piatto.piattoPersonalizzato) {
            if (!prezzo || prezzo <= 0) {
                return res.status(400).json({ success: false, message: 'Prezzo obbligatorio e deve essere maggiore di 0' });
            }
            piatto.prezzo = prezzo;
            await ristorante.save();
            return res.json({ success: true, message: 'Prezzo aggiornato con successo (piatto comune)' });
        }

        // Aggiornamento piatto personalizzato: campi opzionali
        // Validazione minima
        if (prezzo !== undefined && (isNaN(prezzo) || prezzo <= 0)) {
            return res.status(400).json({ success: false, message: 'Prezzo non valido' });
        }
        if (strMeal !== undefined && !strMeal.trim()) {
            return res.status(400).json({ success: false, message: 'Nome piatto non valido' });
        }
        if (strCategory !== undefined && !strCategory.trim()) {
            return res.status(400).json({ success: false, message: 'Categoria non valida' });
        }
        if (ingredients !== undefined && (!Array.isArray(ingredients) || ingredients.length === 0)) {
            return res.status(400).json({ success: false, message: 'Ingredienti non validi' });
        }

        // Applica gli aggiornamenti solo se presenti nel body
        if (prezzo !== undefined) piatto.prezzo = prezzo;
        if (strMeal !== undefined) piatto.strMeal = strMeal;
        if (strCategory !== undefined) piatto.strCategory = strCategory;
        if (ingredients !== undefined) piatto.ingredients = ingredients;
        if (strMealThumb !== undefined) piatto.strMealThumb = strMealThumb;

        await ristorante.save();

        res.json({ success: true, message: 'Piatto personalizzato aggiornato con successo' });
    } catch (err) {
        console.error('❌ Errore aggiornamento piatto:', err);
        res.status(500).json({ success: false, error: 'Errore aggiornamento piatto' });
    }
});

// rimuove piatto dal menu
router.delete('/menu/remove/:menuItemId', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id; //viene dal token jwt
        const { menuItemId } = req.params; //viene dall url, id paitto da togliere

        // trova il ristorante e rimuovi il piatto dal menu
        const ristorante = await User.findByIdAndUpdate(
            ristoranteId,
            {  
                //toglie elementi dell array se corrispondo alla condizione (operatore di mongo)
                //in questo caso togli dall array menu l'oggetto che ha _id uguale a menuItemId.
                $pull: { menu: { _id: menuItemId } }
            },
            { new: true } //dice a mongoose di restituire il documento aggiornato )
        );

        if (!ristorante) {
            return res.status(404).json({ 
                success: false,
                message: 'Ristorante non trovato' 
            });
        }

        res.json({ 
            success: true, message: 'Piatto rimosso dal menu con successo'
        });

    } catch (err) {
        console.error('❌ Errore rimozione piatto:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore rimozione piatto dal menu' 
        });
    }
});

// ==========VISUALIZZAZIONE MENU (accessibile a TUTTI) ==========

// cliente vede menu di un ristorante specifico
router.get('/menu/restaurant/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // trova il ristorante
        const ristorante = await User.findById(id).select('nomeRistorante indirizzo categoria descrizione telefono ruolo menu');

        if (!ristorante) {
            return res.status(404).json({ 
                success: false,
                message: 'Ristorante non trovato' 
            });
        }

        if (ristorante.ruolo !== ROLES.RISTORANTE) {
            return res.status(400).json({ 
                success: false,
                message: 'Questo utente non è un ristorante' 
            });
        }

        
        const menuConDettagli = await GetMenuWithDetails(ristorante.menu);

        res.json({ 
            success: true,
            ristorante: {
                id: ristorante._id,
                nome: ristorante.nomeRistorante,
                indirizzo: ristorante.indirizzo,
                categoria: ristorante.categoria,
                descrizione: ristorante.descrizione,
                telefono: ristorante.telefono
            },
            menu: menuConDettagli
        });

    } catch (err) {
        console.error('❌ Errore recupero menu ristorante:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero menu ristorante' 
        });
    }
});

module.exports = router;
