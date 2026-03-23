const express = require('express');
const router = express.Router();

// Import configurazione condivisa
const { ROLES } = require('../../client/js/config');

const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const Meal = require('../models/mealModel');
const { autenticaToken, checkCliente } = require('../utils/jwt');

// ========== CARRELLO (solo per clienti loggati) ==========

// cliente vede il proprio carrello
router.get('/cart', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;

        // trova il carrello dell'utente
        let cart = await Cart.findOne({ utenteId });

        if (!cart || cart.items.length === 0) {
            return res.json({ 
                success: true,
                message: 'Carrello vuoto',
                cart: {
                    utenteId: utenteId,
                    ristoranteId: null,
                    nomeRistorante: null,
                    items: [],
                    totale: 0
                }
            });
        }

        // Prendi info ristorante 
        const ristorante = await User.findById(cart.ristoranteId).select('nomeRistorante');

        // calcola totale OPZIONE 1 
        /*
        let totale = 0;
        const itemsConDettagli = cart.items.map(item => {
            const subtotale = item.prezzo * item.quantita;
            totale += subtotale;
            return {
                ...item.toObject(),
                subtotale: subtotale
            };
        });

        */

        // calcola totale OPZIONE 2
        //carts.items è un array di documenti mongoose, non semplici oggetti JS
        //item.toObject() converte in oggetto JS semplice, itemscondettagli sarà pulito x invio come json
        const itemsConDettagli = [];
        let totale = 0;
        
        for (const item of cart.items) {
            const subtotale = item.prezzo * item.quantita;
            totale += subtotale;
            
            const itemObj = {       
                _id: item._id,
                menuItemId: item.menuItemId,
                piattoComuneId: item.piattoComuneId,
                piattoPersonalizzato: item.piattoPersonalizzato,
                strMeal: item.strMeal,
                ingredients: item.ingredients,
                strCategory: item.strCategory,
                strMealThumb: item.strMealThumb,
                prezzo: item.prezzo,
                quantita: item.quantita,
                subtotale: subtotale
            };
            itemsConDettagli.push(itemObj);

            }
        

        res.json({ 
            success: true,
            cart: {
                utenteId: cart.utenteId,
                ristoranteId: cart.ristoranteId,
                nomeRistorante: ristorante?.nomeRistorante || 'N/A',
                items: itemsConDettagli,
                totale: totale.toFixed(2) //2 cifre dopo la virgola
            }
        });

    } catch (err) {
        console.error('❌ Errore recupero carrello:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero carrello' 
        });
    }
});

// aggiunge piatto al carrello
router.post('/cart/add', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { ristoranteId, menuItemId, piattoComuneId, piattoPersonalizzato, strMeal, ingredients, strCategory, strMealThumb, prezzo, quantita } = req.body;

        // Validazioni base
        if (!ristoranteId) {
            return res.status(400).json({ 
                success: false,
                message: 'ID ristorante obbligatorio' 
            });
        }

        if (!prezzo || prezzo <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Prezzo non valido' 
            });
        }

        if (quantita === undefined || quantita === null || quantita === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Quantità non valida' 
            });
        }

        // verifica che il ristorante esista
        const ristoranteExists = await User.findOne({ _id: ristoranteId, ruolo: ROLES.RISTORANTE });
        if (!ristoranteExists) {
            return res.status(404).json({ 
                success: false,
                message: 'Ristorante non trovato' 
            });
        }

        // cerca carrello esistente
        let cart = await Cart.findOne({ utenteId });

        if (!cart) {
            // carrello nuovo
            cart = new Cart({
                utenteId: utenteId,
                ristoranteId: ristoranteId,
                items: []
            });
        } else {
            // Se è rimasto senza items (svuotato via rimozioni) lo trattiamo come nuovo e permettiamo cambio ristorante
            if (cart.items.length === 0 && cart.ristoranteId.toString() !== ristoranteId) {
                cart.ristoranteId = ristoranteId; // reset ristorante per nuovo ordine
            } else if (cart.ristoranteId.toString() !== ristoranteId) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Puoi ordinare solo da un ristorante alla volta. Svuota il carrello prima di ordinare da un altro ristorante.',
                    currentRistoranteId: cart.ristoranteId
                });
            }
        }

        // Prepara il nuovo item
        const nuovoItem = {
            menuItemId: menuItemId || null,
            piattoComuneId: piattoComuneId || null,
            piattoPersonalizzato: piattoPersonalizzato || false,
            strMeal: strMeal,
            ingredients: ingredients || [],
            strCategory: strCategory || '',
            strMealThumb: strMealThumb || '',
            prezzo: prezzo,
            quantita: quantita
        };

        // controlla se il piatto è già nel carrello
        const itemEsistente = cart.items.find(item => {
            // Priorità al menuItemId se presente
            if (menuItemId) {
                return item.menuItemId?.toString() === menuItemId;
            }
            // Altrimenti usa la logica precedente
            if (piattoComuneId) {
                return item.piattoComuneId === piattoComuneId;
            } else {
                return item.strMeal === strMeal && item.piattoPersonalizzato === true;
            }
        });

        if (itemEsistente) {
            // se già presente, aumenta/diminuisci la quantità
            itemEsistente.quantita += quantita;
            
            // Se la quantità risultante è <= 0, rimuovi l'item
            if (itemEsistente.quantita <= 0) {
                cart.items = cart.items.filter(item => {
                    if (menuItemId) {
                        return item.menuItemId?.toString() !== menuItemId;
                    }
                    if (piattoComuneId) {
                        return item.piattoComuneId !== piattoComuneId;
                    }
                    return item.strMeal !== strMeal || !item.piattoPersonalizzato;
                });
            }
        } else {
            // altrimenti aggiungilo (solo se quantità positiva)
            if (quantita > 0) {
                cart.items.push(nuovoItem);
            }
        }

        await cart.save();

        // Se dopo l'operazione il carrello è vuoto, lo eliminiamo del tutto così da permettere cambio ristorante immediato
        if (cart.items.length === 0) {
            await Cart.findOneAndDelete({ utenteId });
            return res.status(201).json({ 
                success: true,
                message: 'Ultimo piatto rimosso: carrello ora vuoto e reimpostato',
                cart: {
                    utenteId: utenteId,
                    ristoranteId: null,
                    items: [],
                    totale: 0
                }
            });
        }

        res.status(201).json({ 
            success: true,
            message: 'Piatto aggiunto al carrello con successo',
            cart: cart
        });

    } catch (err) {
        console.error('❌ Errore aggiunta al carrello:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore aggiunta al carrello' 
        });
    }
});

// modifica quantità di un item
router.patch('/cart/update/:itemId', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { itemId } = req.params;
        const { quantita } = req.body;

        //controllo validità quantità
        if( quantita === 0 ){
            const cart = await Cart.findOneAndUpdate(
                { utenteId: utenteId },
                { $pull: { items: { _id: itemId } } }, // rimuove l'item
                { new: true }
            );

            if (!cart) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Carrello non trovato' 
                });
            }

            // Se dopo la rimozione non ci sono più items eliminiamo il carrello per consentire cambio ristorante
            if (cart.items.length === 0) {
                await Cart.findOneAndDelete({ utenteId });
                return res.json({ 
                    success: true,
                    message: 'Piatto rimosso. Carrello ora vuoto e reimpostato',
                    cart: {
                        utenteId: utenteId,
                        ristoranteId: null,
                        items: [],
                        totale: 0
                    }
                });
            }

            return res.json({ 
                success: true,
                message: 'Piatto rimosso dal carrello (quantità = 0)',
                cart: cart
            });
            /*
            return res.status(400).json({ 
                success: false,
                message: 'Per rimuovere un piatto usa l\'endpoint di rimozione' 
            });
            */
        }

        if (!quantita || quantita < 1) {
            return res.status(400).json({ 
                success: false,
                message: 'Quantità invalida' 
            });
        }

        // fare due find separate prima del carrello poi dell'item in esso, e imostare la quantita infine await cart.save(), ma lento
        // Aggiorna la quantità dell'item modo veloce:
        const cart = await Cart.findOneAndUpdate(
            { 
                // cerca carrello di un certo utente e che contiene un item con questo 
                // specifico _id uguale a itemId
                utenteId: utenteId, 'items._id': itemId 
            },
            { 
                //dentro l'array di items, l'item che ha _id=itemId, 
                // aggiorna la sua quantita ($set)
                //operatore .$ indica il campo quantita di quell elemento specifico di items 
                // che è stato trovato nella query precedente
                $set: { 'items.$.quantita': quantita } 
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ 
                success: false,
                message: 'Item non trovato nel carrello' 
            });
        }

        res.json({ 
            success: true,
            message: 'Quantità aggiornata con successo',
            cart: cart
        });

    } catch (err) {
        console.error('❌ Errore aggiornamento carrello:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore aggiornamento carrello' 
        });
    }
});

// rimuove item dal carrello
router.delete('/cart/remove/:menuItemId', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { menuItemId } = req.params;

        // Rimuovi l'item dal carrello usando menuItemId
        const cart = await Cart.findOneAndUpdate(
            { utenteId: utenteId },
            { 
                $pull: { items: { menuItemId: menuItemId } } 
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ 
                success: false,
                message: 'Carrello non trovato' 
            });
        }

        if (cart.items.length === 0) {
            await Cart.findOneAndDelete({ utenteId });
            return res.json({ 
                success: true,
                message: 'Piatto rimosso. Carrello svuotato e reimpostato',
                cart: {
                    utenteId: utenteId,
                    ristoranteId: null,
                    items: [],
                    totale: 0
                }
            });
        }

        res.json({ 
            success: true,
            message: 'Piatto rimosso dal carrello con successo',
            cart: cart
        });

    } catch (err) {
        console.error('❌ Errore rimozione dal carrello:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore rimozione dal carrello' 
        });
    }
});

// svuota completamente il carrello
router.delete('/cart/clear', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;

        // elimina il carrello
        await Cart.findOneAndDelete({ utenteId: utenteId });

        res.json({ 
            success: true,
            message: 'Carrello svuotato con successo'
        });

    } catch (err) {
        console.error('❌ Errore svuotamento carrello:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore svuotamento carrello' 
        });
    }
});

module.exports = router;
