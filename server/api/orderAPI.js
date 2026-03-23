const express = require('express');
const router = express.Router();

// Import configurazione condivisa
const { ROLES, ORDER_STATES } = require('../../client/js/config');

const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const { autenticaToken, checkCliente, checkRistorante } = require('../utils/jwt');

/*
 SISTEMA DI GESTIONE ORDINI CON TIMER AUTOMATICO

  
  FLUSSO DEGLI ORDINI:
  1. CLIENTE CREA ORDINE-> Stato: "ordinato" (carrello viene svuotato)
  2.  RISTORANTE INIZIA PREP -> Stato: "in preparazione" + imposta timer (es. 25 min)
  3.  TIMER AUTOMATICO (utils/orderTimer.js) -> Quando scade: "in preparazione" - "pronto"
  4.  ASPETTA CLIENTE-> Stato: "pronto" (ristorante aspetta il ritiro)
  5.  RISTORANTE MARCA "IN CONSEGNA" (opzionale, SCELTA DOMICILIO) o CLIENTE VA DIRETTO A "CONSEGNATO"
  6.  CLIENTE CONFERMA RICEZIONE -> "consegnato" 
  
   STATI POSSIBILI:
  - ordinato (cliente ha appena ordinato)
  - in preparazione (ristorante sta cucinando, timer attivo)
  - pronto (ordine pronto per il ritiro, timer scaduto)
  - in consegna (ristorante ha dei l'ordine o sta consegnando) SOOLO SE SCELTA DOMICILIO 
  - consegnato (cliente ha ritirato/ricevuto)
  - annullato (cliente ha cancellato un ordine non ancora in preparazione)
  
   RUOLI:
  - Solo CLIENTE può creare ordine e confermare ricezione (mark-delivered)
  - solo RISTORANTE può iniziare preparazione e aggiornare stati intermedi
  - Il TIMER (job separato) aggiorna "in preparazione"-> "pronto" automaticamente
  
*/

// ========== ORDINI CLIENTE - endPoint accessibili solo ai clienti loggati ==========


// cliente crea un ordine dalla lista dei piatti nel suo carrello
// l'ordine parte con stato "ordinato" e il carrello viene automaticamente svuotato
router.post('/orders/create', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { metodoPagamento, tipoOrdine } = req.body;

        if (!metodoPagamento || !metodoPagamento.tipo) {
            return res.status(400).json({ 
                success: false,
                message: 'Metodo di pagamento obbligatorio' 
            });
        }

        // Trova il carrello
        const cart = await Cart.findOne({ utenteId });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Carrello vuoto' 
            });
        }

        // prepara i dati dell'ordine trasformando gli articoli del carrello
        const nuovoOrdine = new Order({
            utenteId: cart.utenteId,
            ristoranteId: cart.ristoranteId,
            piatti: cart.items.map(item => ({
                piattoPersonalizzato: item.piattoPersonalizzato || false,
                strMeal: item.strMeal || item.nome || 'Piatto senza nome',
                ingredients: item.ingredients || [],
                piattoComuneId: item.piattoComuneId || null,
                menuItemId: item.menuItemId || null,
                immagine: item.strMealThumb || item.immagine || '',
                categoria: item.strCategory || item.categoria || '',
                prezzo: item.prezzo,
                quantita: item.quantita
            })),
            metodoPagamentoUsato: metodoPagamento,
            tipoOrdine: tipoOrdine || 'ritiro', // default ritiro
            stato: ORDER_STATES.ORDINATO
        });

        await nuovoOrdine.save();

        // svuota il carrello dopo aver creato l'ordine (il cliente deve iniziare da capo se vuole ordinare di nuovo. puo riordinare lo stesso ordine dallo storico.)
        await Cart.findOneAndDelete({ utenteId });

        res.status(201).json({ 
            success: true,
            message: 'Ordine creato con successo',
            ordine: nuovoOrdine
        });

    } catch (err) {
        console.error('❌ Errore creazione ordine:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore creazione ordine' 
        });
    }
});

// GET /orders/mine
// VISUALIZZAZIONE: cliente vede tutti i suoi ordini (con filtro opzionale per stato da implementare)
// per la pagina "I miei ordini" dove il cliente può tracciare le preparazioni
router.get('/orders/mine', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { stato } = req.query; // filtro opzionale: ?stato=in preparazione
        //filtro ha utendid sempre
        // costruisci il filtro
        let filtro = { utenteId: utenteId };
        if (stato) {
            filtro.stato = stato;   // altrimenti filtro rimane solo utenteId
        }

        // recupera tutti gli ordini del cliente, ordinati dal più recente al più vecchio
        const ordini = await Order.find(filtro).sort({ createdAt: -1 });

        // popola i nomi dei ristoranti dagli ordini 
        // nota: utilizzo un ciclo manuale invece di Promise.all per evitare troppe query parallele al database e mantenere l'elaborazione sequenziale ance se più lenta
        const ordiniConDettagli = [];
        for (const ordine of ordini) {
            const ristorante = await User.findById(ordine.ristoranteId).select('nomeRistorante telefono indirizzo');
            
            // calcola il totale: somma (prezzo * quantità) per ogni piatto
            const totale = ordine.piatti.reduce((sum, piatto) => {
            return sum + (piatto.prezzo * piatto.quantita);
            }, 0);

            ordiniConDettagli.push({
            _id: ordine._id,
            orderId: ordine.orderId || ordine._id.toString().slice(-8),
            ristoranteId: ordine.ristoranteId,
            nomeRistorante: ristorante?.nomeRistorante || 'N/A',
            telefonoRistorante: ristorante?.telefono || 'N/A',
            indirizzoRistorante: ristorante?.indirizzo || 'N/A',
            piatti: ordine.piatti,
            totale: totale.toFixed(2), // due decimali
            stato: ordine.stato,
            tipoOrdine: ordine.tipoOrdine || 'ritiro',
            tempoAttesa: ordine.tempoAttesa,
            tempoConsegnaStimato: ordine.tempoConsegnaStimato,
            metodoPagamento: ordine.metodoPagamentoUsato,
            createdAt: ordine.createdAt,
            updatedAt: ordine.updatedAt
            });
        }        

        /*
         const ordiniConDettagli = await Promise.all(
            ordini.map(async (ordine) => {
                const ristorante = await User.findById(ordine.ristoranteId).select('nomeRistorante telefono indirizzo');
                
                // Calcola totale
                const totale = ordine.piatti.reduce((sum, piatto) => {
                    return sum + (piatto.prezzo * piatto.quantita);
                }, 0);

                return {
                    _id: ordine._id,
                    orderId: ordine.orderId || ordine._id.toString().slice(-8),
                    ristoranteId: ordine.ristoranteId,
                    nomeRistorante: ristorante?.nomeRistorante || 'N/A',
                    telefonoRistorante: ristorante?.telefono || 'N/A',
                    indirizzoRistorante: ristorante?.indirizzo || 'N/A',
                    piatti: ordine.piatti,
                    totale: totale.toFixed(2),
                    stato: ordine.stato,
                    tempoAttesa: ordine.tempoAttesa,
                    metodoPagamento: ordine.metodoPagamentoUsato,
                    createdAt: ordine.createdAt,
                    updatedAt: ordine.updatedAt
                };
            })
        );
        */

        res.json({ 
            success: true,
            count: ordiniConDettagli.length,
            ordini: ordiniConDettagli
        });

    } catch (err) {
        console.error('❌ Errore recupero ordini:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero ordini' 
        });
    }
});

// ========== ORDINI RISTORANTE - EndPoint accessibili solo ai ristoranti loggati ==========
// IMPORTANTE eve essere PRIMA di GET /orders/:id per evitare conflitti di routing (express riuscire a distinguere 'restaurant' da ':id'...)

// DASHBOARD RISTORANTE: Il ristorante vede tutti i suoi ordini con filtro opzionale per stato da implementare
router.get('/orders/restaurant', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id;
        const { stato } = req.query; // filtro opzionale: ?stato=in preparazione

        // filtro: sempre per ristoranteId, opzionalmente per stato
        let filtro = { ristoranteId: ristoranteId };
        if (stato) {
            filtro.stato = stato; // Es: "ordinato", "in preparazione", "pronto", ecc.
        }

        // trova tutti gli ordini del ristorante
        const ordini = await Order.find(filtro).sort({ createdAt: -1 });

        // popola i dati dei clienti (elaborazione sequenziale)
        const ordiniConDettagli = [];
        for (const ordine of ordini) {
            const cliente = await User.findById(ordine.utenteId).select('nome cognome telefono indirizzo');
            
            // calcola totale 
            //potevo farlo anche con proise . all interno del map
            const totale = ordine.piatti.reduce((sum, piatto) => {
            return sum + (piatto.prezzo * piatto.quantita);
            }, 0);

            ordiniConDettagli.push({
            _id: ordine._id,
            orderId: ordine.orderId || ordine._id.toString().slice(-8),
            cliente: {
                id: ordine.utenteId,
                nome: cliente?.nome || 'N/A',
                cognome: cliente?.cognome || '',
                telefono: cliente?.telefono || 'N/A',
                indirizzo: cliente?.indirizzo || 'N/A'
            },
            piatti: ordine.piatti,
            totale: totale.toFixed(2),
            stato: ordine.stato,
            tipoOrdine: ordine.tipoOrdine || 'ritiro',
            tempoAttesa: ordine.tempoAttesa,
            tempoConsegnaStimato: ordine.tempoConsegnaStimato,
            metodoPagamento: ordine.metodoPagamentoUsato,
            createdAt: ordine.createdAt,
            updatedAt: ordine.updatedAt
            });
        }
        res.json({ 
            success: true,
            count: ordiniConDettagli.length,
            ordini: ordiniConDettagli
        });

    } catch (err) {
        console.error('❌ Errore recupero ordini ristorante:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero ordini ristorante' 
        });
    }
});

// dettaglio ordine specifico
router.get('/orders/:id', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { id } = req.params;

        // trova l'ordine (solo se appartiene all'utente)
        const ordine = await Order.findOne({ _id: id, utenteId: utenteId });

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // Popola dettagli ristorante
        const ristorante = await User.findById(ordine.ristoranteId).select('nomeRistorante telefono indirizzo');

        // calcola totale senza reduce
        let totale = 0;
        for (const piatto of ordine.piatti) {
            totale += (piatto.prezzo * piatto.quantita);
        }
        /*
                // calcola totale senza reduce
        let totale = 0;
            //sum è accumulatore, piatto è elemento corrente, viene salvato in sum il risultato di ogni iterazione
            // e poi viene utilizzato per calcolare il totale finale ( valore di return salvato in totale)
            return sum + (piatto.prezzo * piatto.quantita);
        }, 0);
        */

        res.json({ 
            success: true,
            ordine: {
                _id: ordine._id,
                orderId: ordine.orderId || ordine._id.toString().slice(-8),
                nomeRistorante: ristorante?.nomeRistorante || 'N/A',
                ristorante: {
                    id: ordine.ristoranteId,
                    nome: ristorante?.nomeRistorante || 'N/A',
                    telefono: ristorante?.telefono || 'N/A',
                    indirizzo: ristorante?.indirizzo || 'N/A'
                },
                piatti: ordine.piatti,
                totale: totale.toFixed(2),
                stato: ordine.stato,
                tipoOrdine: ordine.tipoOrdine || 'ritiro',
                tempoAttesa: ordine.tempoAttesa,
                tempoConsegnaStimato: ordine.tempoConsegnaStimato,
                metodoPagamentoUsato: ordine.metodoPagamentoUsato,
                createdAt: ordine.createdAt,
                updatedAt: ordine.updatedAt
            }
        });

    } catch (err) {
        console.error('❌ Errore recupero dettaglio ordine:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero dettaglio ordine' 
        });
    }
});

// GET /orders/restaurant/:id - Ristorante vede dettaglio ordine
router.get('/orders/restaurant/:id', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id;
        const { id } = req.params;

        // Trova l'ordine (solo se appartiene al ristorante)
        const ordine = await Order.findOne({ _id: id, ristoranteId: ristoranteId });

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // Popola dettagli cliente
        const cliente = await User.findById(ordine.utenteId).select('nome cognome telefono indirizzo');

        // calcola totale
        let totale = 0;
        for (const piatto of ordine.piatti) {
            totale += (piatto.prezzo * piatto.quantita);
        }

        res.json({ 
            success: true,
            ordine: {
                _id: ordine._id,
                orderId: ordine.orderId || ordine._id.toString().slice(-8),
                cliente: {
                    id: ordine.utenteId,
                    nome: cliente?.nome || 'N/A',
                    cognome: cliente?.cognome || '',
                    telefono: cliente?.telefono || 'N/A',
                    indirizzo: cliente?.indirizzo || 'N/A'
                },
                piatti: ordine.piatti,
                totale: totale.toFixed(2),
                stato: ordine.stato,
                tipoOrdine: ordine.tipoOrdine || 'ritiro',
                tempoAttesa: ordine.tempoAttesa,
                tempoConsegnaStimato: ordine.tempoConsegnaStimato,
                metodoPagamentoUsato: ordine.metodoPagamentoUsato,
                createdAt: ordine.createdAt,
                updatedAt: ordine.updatedAt
            }
        });

    } catch (err) {
        console.error('❌ Errore recupero dettaglio ordine ristorante:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore recupero dettaglio ordine' 
        });
    }
});

// PATCH /orders/:id/cancel - cancella ordine (solo se stato = "ordinato")
router.patch('/orders/:id/cancel', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { id } = req.params;

        // trova l'ordine
        const ordine = await Order.findOne({ _id: id, utenteId: utenteId });

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // verifica che sia ancora in stato "ordinato" (non ancora iniziata la preparazione)
        if (ordine.stato !== ORDER_STATES.ORDINATO) {
            return res.status(400).json({ 
                success: false,
                message: 'Puoi cancellare solo ordini con stato "ordinato"' 
            });
        }

        // cambia lo stato in 'annullato' invece di eliminare
        ordine.stato = ORDER_STATES.ANNULLATO;
        await ordine.save();

        res.json({ 
            success: true,
            message: 'Ordine cancellato con successo'
        });

    } catch (err) {
        console.error('❌ Errore cancellazione ordine:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore cancellazione ordine' 
        });
    }
});


// UPDATE MANUALE STATO: permette al ristorante di cambiare lo stato dell'ordine manualmente
// NB; il passaggio da in prep a pronto pui avvenire ANCHE automaticamente via timer (utils/orderTimer.js)
router.patch('/orders/:id/status', autenticaToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.ruolo;
        const { id } = req.params;
        const { stato, tempoAttesa } = req.body;

        // v alidazione stato
        // validazione stato - Tutti gli stati possibili tranne i finali (consegnato, annullato)
        const statiPermessi = [ORDER_STATES.ORDINATO, ORDER_STATES.IN_PREPARAZIONE, ORDER_STATES.PRONTO, ORDER_STATES.IN_CONSEGNA, ORDER_STATES.CONSEGNATO, ORDER_STATES.ANNULLATO];
        if (!stato || !statiPermessi.includes(stato)) {
            return res.status(400).json({ 
                success: false,
                message: 'Stato non valido. Stati permessi: ordinato, in preparazione, pronto, in consegna, consegnato, annullato' 
            });
        }

        // ristorante vede solo i suoi ordini, cliente vede solo i suoi
        let ordine;
        if (userRole === ROLES.RISTORANTE) {
            ordine = await Order.findOne({ _id: id, ristoranteId: userId });
        } else if (userRole === ROLES.CLIENTE) {
            ordine = await Order.findOne({ _id: id, utenteId: userId });
        } else {
            return res.status(403).json({ 
                success: false,
                message: 'Ruolo non autorizzato' 
            });
        }

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // stati finali:  "consegnato" e "annullato" non possono essere modificati (regola per ocnvenione)
       
        if ([ORDER_STATES.CONSEGNATO, ORDER_STATES.ANNULLATO].includes(ordine.stato)) {
            return res.status(400).json({ 
                success: false,
                message: `Impossibile modificare un ordine ${ordine.stato}. Questo è uno stato finale.` 
            });
        }

        // 🔐 Regola di sicurezza: solo il CLIENTE può confermare consegnato
        if (stato === ORDER_STATES.CONSEGNATO && userRole !== ROLES.CLIENTE) {
            return res.status(403).json({ 
                success: false,
                message: 'Solo il cliente può confermare la ricezione dell\'ordine' 
            });
        }

        // il cliente può SOLO confermare la ricezione (pronto/in consegna -> consegnato)
        if (userRole === ROLES.CLIENTE) {
            if (stato !== ORDER_STATES.CONSEGNATO) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Il cliente può solo confermare la ricezione dell\'ordine' 
                });
            }
            // il cliente può confermare la ricezione se l'ordine è "pronto" o "in consegna"
            if (ordine.stato !== ORDER_STATES.PRONTO && ordine.stato !== ORDER_STATES.IN_CONSEGNA) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Puoi confermare solo ordini "pronto" o "in consegna"' 
                });
            }
        }

        // validazione transizioni di stato (solo per ristorante)
        if (userRole === ROLES.RISTORANTE) {
            const statoAttuale = ordine.stato;
            
            //  RISTORANTE NON PUÒ TOCCARE ORDINI ANNULLATI
            // se il cliente ha annullato l'ordine, il ristorante non deve nemmeno vederlo come modificabile
            if (statoAttuale === ORDER_STATES.ANNULLATO) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Questo ordine è stato annullato dal cliente. Non puoi modificarlo.' 
                });
            }
            
            // le transizioni valide dipendono dal tipo di ordine
            let transizioniValide = {
                [ORDER_STATES.ORDINATO]: [ORDER_STATES.IN_PREPARAZIONE], // ristorante dice "inizia a cucinare"
                [ORDER_STATES.IN_PREPARAZIONE]: [ORDER_STATES.PRONTO], // pronto quando finisce di cucinare
                [ORDER_STATES.PRONTO]: [], //da "pronto" può solo andare a "in consegna" (se domicilio)
                [ORDER_STATES.IN_CONSEGNA]: [], //il ristorante non può più fare nulla
                [ORDER_STATES.CONSEGNATO]: [] //stato finale, nessun cambio possibile
            };
            
            // se l'ordine è con consegna a domicilio, aggiungi transizione "in consegna"
            if (ordine.tipoOrdine === 'domicilio') {
                transizioniValide[ORDER_STATES.IN_PREPARAZIONE].push(ORDER_STATES.IN_CONSEGNA);
                transizioniValide[ORDER_STATES.PRONTO].push(ORDER_STATES.IN_CONSEGNADER_STATES.IN_CONSEGNA);
            }

            if (!transizioniValide[statoAttuale].includes(stato)) {
                return res.status(400).json({ 
                    success: false,
                    message: `Impossibile cambiare stato da "${statoAttuale}" a "${stato}". ${ordine.tipoOrdine === 'ritiro' ? 'Per ordini con ritiro, usa lo stato "pronto".' : ''}` 
                });
            }
        }

        // salva il tempo di attesa e calcola quando sarà pronto
        //timer auto
        if (stato === ORDER_STATES.IN_PREPARAZIONE) {
            if (!tempoAttesa || tempoAttesa < 5 || tempoAttesa > 120) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Tempo di attesa obbligatorio per "in preparazione" (5-120 minuti)' 
                });
            }
            
            ordine.tempoAttesa = tempoAttesa;
            // calcola il tempo di consegna stimato (ora + minuti di attesa)
            ordine.tempoConsegnaStimato = new Date(Date.now() + tempoAttesa * 60 * 1000);
        }

        // SE PRONTO MANUALMENTE: rist mette "pronto", resetta il timer
        // (perché il timer l'avrebbe fatto comunque,)
        if (stato === ORDER_STATES.PRONTO) {
            ordine.tempoConsegnaStimato = null; // Resetta il timer
        }

        // aggiorna lo stato
        ordine.stato = stato;
        await ordine.save();

        res.json({ 
            success: true,
            message: 'Stato ordine aggiornato con successo',
            ordine: {
                id: ordine._id,
                statoNuovo: ordine.stato,
                tempoAttesa: ordine.tempoAttesa,
                tempoConsegnaStimato: ordine.tempoConsegnaStimato,
                updatedAt: ordine.updatedAt
            }
        });

    } catch (err) {
        console.error('❌ Errore aggiornamento stato:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore aggiornamento stato ordine' 
        });
    }
});

// ristorante inizia preparazione e imposta tempo
router.patch('/orders/:id/start-preparation', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const ristoranteId = req.user.id;
        const { id } = req.params;
        const { tempoAttesa } = req.body; // tempo in minuti

        if (!tempoAttesa || tempoAttesa < 1 || tempoAttesa > 120) {
            return res.status(400).json({ 
                success: false,
                message: 'Tempo di attesa non valido (1-120 minuti)' 
            });
        }

        // Trova l'ordine
        const ordine = await Order.findOne({ _id: id, ristoranteId: ristoranteId });

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // controlla che l'ordine sia in stato "ordinato"
        if (ordine.stato !== 'ordinato') {
            return res.status(400).json({ 
                success: false,
                message: 'Puoi iniziare la preparazione solo per ordini con stato "ordinato"' 
            });
        }

        // calcola il tempo di consegna stimato
        const tempoConsegnaStimato = new Date();
        tempoConsegnaStimato.setMinutes(tempoConsegnaStimato.getMinutes() + tempoAttesa);

        // aggiorna l'ordine: stato, tempo di attesa e tempo stimato
        const ordineAggiornato = await Order.findByIdAndUpdate(
            id,
            {
                stato: 'in preparazione',
                tempoAttesa: tempoAttesa,
                tempoConsegnaStimato: tempoConsegnaStimato
            },
            { new: true }
        );

        res.json({ 
            success: true,
            message: `Preparazione iniziata! Ordine sarà pronto in ${tempoAttesa} minuti`,
            ordine: {
                id: ordineAggiornato._id,
                stato: ordineAggiornato.stato,
                tempoAttesa: ordineAggiornato.tempoAttesa,
                tempoConsegnaStimato: ordineAggiornato.tempoConsegnaStimato,
                saràProntoAlle: tempoConsegnaStimato.toLocaleTimeString('it-IT')
            }
        });

    } catch (err) {
        console.error('❌ Errore inizio preparazione:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore inizio preparazione' 
        });
    }
});

// cliente conferma di aver ritirato/ricevuto l'ordine
// l'ordine passa da "pronto" o "in consegna" a "consegnato" (ORDINE COMPLETATO)
router.patch('/orders/:id/mark-delivered', autenticaToken, checkCliente, async (req, res) => {
    try {
        const utenteId = req.user.id;
        const { id } = req.params;

        // Trova l'ordine
        const ordine = await Order.findOne({ _id: id, utenteId: utenteId });

        if (!ordine) {
            return res.status(404).json({ 
                success: false,
                message: 'Ordine non trovato' 
            });
        }

        // controlla che l'ordine sia pronto o in consegna
        if (!['pronto', 'in consegna'].includes(ordine.stato)) {
            return res.status(400).json({ 
                success: false,
                message: 'Puoi confermare solo ordini pronti o in consegna' 
            });
        }

        // aggiorna a consegnato
        const ordineAggiornato = await Order.findByIdAndUpdate(
            id,
            { stato: 'consegnato' },
            { new: true }
        );

        res.json({ 
            success: true,
            message: 'Ordine confermato come ricevuto!',
            ordine: {
                id: ordineAggiornato._id,
                stato: ordineAggiornato.stato
            }
        });

    } catch (err) {
        console.error('❌ Errore conferma ricezione:', err);
        res.status(500).json({ 
            success: false,
            error: 'Errore conferma ricezione' 
        });
    }
});



module.exports = router;
