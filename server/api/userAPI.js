const express = require('express');
const router = express.Router();

const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const Meal = require('../models/mealModel');

const { validateRegister, validateLogin, validateUpdate, validatePswUpdate, handleValidationErr } = require('../validators/userValidators');
//const { body, validationResult } = require('express-validator');

// import configurazione condivisa
const { ROLES } = require('../../client/js/config');

const { connect } = require('../config/db');
const { close } = require('../config/db');

const { hashPassword, checkPassword } = require('../utils/argon2');
const { autenticaToken, generaToken } = require('../utils/jwt');


//----------------------------post api/regiuster--------------------------------
router.post('/register', validateRegister, handleValidationErr, async(req,res) =>{

    try{
        console.log(' Dati ricevuti per registrazione:', req.body);
        //prendo i dati dal req.body
        const {
            ruolo, nome, cognome, preferenze, nomeRistorante, partitaIVA, indirizzo, categoria, descrizione, metodiPagamento, email, password, telefono } = req.body;

        console.log(' Campi estratti:', { ruolo, nomeRistorante, partitaIVA, email, password: password ? '[PRESENTE]' : '[MANCANTE]' });

        //controllo campi comuni
        if(!ruolo  || !email || !password){
            return res.status(400).json({error: 'Ruolo, email, e password sono obbligatori'});
        }

        if (ruolo === ROLES.CLIENTE) {
            if (!nome || !cognome) {
                return res.status(400).json({ message: "Nome e cognome obbligatori per cliente" });
            }
        }

        if (ruolo === ROLES.RISTORANTE) {
            if (!nomeRistorante || !partitaIVA) {
                return res.status(400).json({ message: "Nome ristorante, partita IVA sono obbligatori per ristorante" });
            }
        }

        // controllo se email già registrata
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email già registrata" });
        }

        // hash password con Argon2
        //const passwordHash = await argon2.hash(password);
        const passwordHash = await hashPassword(password);

        // creazione utente
        const newUser = new User({
            ruolo, nome, cognome, preferenze, nomeRistorante, partitaIVA, indirizzo, categoria, descrizione, email, passwordHash, telefono, metodiPagamento
        });

        await newUser.save();

        //generazione token, registrazione avvenuta. creo token = rimane loggato dopo la registrazione
        //cosi passo tutti i dati di newuser inclusa password e menu... poco sicuro.
        //const token = await generaToken(newUser);
        
        //alternativa sicura solo con dati necessari: 
        const token = generaToken({
            id: newUser._id,
            ruolo: newUser.ruolo,
            email: newUser.email
            });

         // invio token come cookie http-only
        // . generaToken crea il token con id/ruolo/email
        // . inviamo il token come cookie httpOnly (non leggibile da JS, lato client non puo rubare session cookie e impersonare. 
        //      non puo iniettare codice js + nel validator faccio escape().  evitando xss cross site scripting )
        // . autenticaToken legge il cookie e verifica il token per proteggere le rotte 
        res.cookie('token', token, {
            httpOnly: true,       // non leggibile dal JS lato client
            maxAge: 24*60*60*1000, // 1 giorno in ms
            secure: false,        // true se HTTPS // in locale devo mettere false
            sameSite: 'strict'    // protezione CSRF (impedisce l invio dei cookie di un user a siti esterni che fanno richiesta al mio server)
        });   
        
        //feedback
        res.status(201).json({
            message: "Utente registrato con successo",
            user: {
                id: newUser._id,
                ruolo: newUser.ruolo,
                email: newUser.email
            }
        });

    }catch(err){
        
        console.error("❌ Errore registrazione:", err);
        res.status(500).json({ error: "Errore del server" });
        

    }

});

// --------------------------POST api/login -----------------------------------
router.post('/login', validateLogin, handleValidationErr, async (req, res) => {
    try {
        const { email, password } = req.body;  //prendo email e password dal reqbody

        //cntrolla se esiste l'utente
        const utente = await User.findOne({ email });
        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        //verifica la password con Argon2
        const passwordValida = await checkPassword( password, utente.passwordHash);
        if (!passwordValida) {
            return res.status(401).json({ message: 'Password errata' });
        }

        //genera token JWT sicuro
        const token = generaToken({
            id: utente._id,
            ruolo: utente.ruolo,
            email: utente.email
        });

        // invio come cookie http-only
        res.cookie('token', token, {
            httpOnly: true,       // non leggibile dal JS lato client
            maxAge: 24*60*60*1000, // 1 giorno in ms
            secure: false,        // true se HTTPS
            sameSite: 'strict'    // protezione CSRF
        });

        //risposta di feedback
        res.json({
            message: 'Login effettuato con successo',
            //token,
            user: {
                id: utente._id,
                ruolo: utente.ruolo,
                email: utente.email,
                nome: utente.nome || null,
                cognome: utente.cognome || null,
                nomeRistorante: utente.nomeRistorante || null
            }
        });

    } catch (err) {
        console.error("❌ Errore login:", err);
        res.status(500).json({ error: '❌ Errore del server' });
    }

});



router.post('/logout', (req, res) => {
    //cancella il cookie 'token', res.clearcookie('token') non affidabile su alcuni browser
    res.clearCookie('token', { httpOnly: true, secure: false, sameSite: 'strict' });      

    res.json({ success: true, message: 'Logout effettuato con successo' });

});


router.delete('/user/delete', autenticaToken, async(req,res) => {
    try {
        const userId = req.user.id; // id preso dal token
        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        // cancella anche il cookie per "logout"
        res.clearCookie('token', { httpOnly: true, secure: false, sameSite: 'strict' });

        res.json({ message: 'Utente cancellato con successo' });

    } catch (err) {
        console.error('Errore cancellazione utente:', err);
        res.status(500).json({ error: '❌ Errore del server' });
    }
});


router.get('/profile', autenticaToken, async(req,res) => {
    try{
        const userId = req.user.id; // id preso dal token
        const utente = await User.findById(userId).select('-passwordHash'); //non restituisco la password

        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        res.json({success: true, message: 'Token valido', user: utente});

    }catch(err){
        console.error('Errore /profile:', err);
        res.status(500).json({ error: '❌ Errore del server' });
    }
})

//con patch al posto di put mdofico solo i campi presenti nel body, Gli altri rimangono invariati.
router.patch('/user/update', autenticaToken, validateUpdate, handleValidationErr, async (req, res) => { 
    //non mail, email è unique e true, la uso come identificativo univoco dell utente
    try {
        const userId = req.user.id;
        const updates = req.body;

        // filtra i campi permessi in base al ruolo
        let allowedFields = [];

        if (req.user.ruolo === ROLES.CLIENTE) {
            allowedFields = ['nome', 'cognome', 'telefono', 'preferenze', 'password', 'metodiPagamento'];
        } 
        else if (req.user.ruolo === ROLES.RISTORANTE) {
            // AGGIUNTO 'immagine' ai campi aggiornabili per permettere il salvataggio dell'URL immagine profilo
            allowedFields = ['nomeRistorante', 'indirizzo', 'categoria', 'descrizione', 'telefono', 'password', 'immagine'];
        }

        // rimuove eventuali campi non permessi
        for (let key in updates) {
            if (!allowedFields.includes(key)) delete updates[key];
        }

        // gestisci eventuale cambio password
        if (updates.password) {
            updates.passwordHash = await hashPassword(updates.password);
            delete updates.password;
        }

        // Log diagnostico aggiornamento immagine (se presente)
        if (typeof updates.immagine !== 'undefined') {
            console.log('🖼️ Richiesta aggiornamento immagine profilo:', updates.immagine);
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-passwordHash');

        if (updatedUser && typeof updates.immagine !== 'undefined') {
            console.log('✅ Immagine salvata nel profilo:', updatedUser.immagine);
        }

        if (!updatedUser) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        res.json({
            message: 'Profilo aggiornato con successo',
            user: updatedUser
        });

    } catch (err) {
        console.error('❌ Errore aggiornamento utente:', err);
        res.status(500).json({ error: 'Errore del server' });
    }
});

router.patch('/user/update/password', autenticaToken, validatePswUpdate, handleValidationErr, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Inserisci la vecchia e la nuova password' });
        }
        
        if (oldPassword === newPassword) {
            return res.status(400).json({ message: 'La nuova password non può essere uguale alla vecchia' });
            }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        const isMatch = await checkPassword(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Vecchia password errata' });
        }

        user.passwordHash = await hashPassword(newPassword);
        await user.save();

        res.json({ message: 'Password aggiornata con successo' });

    } catch (err) {
        console.error('❌ Errore aggiornamento password:', err);
        res.status(500).json({ error: 'Errore del server' });
    }
});

module.exports = router;


