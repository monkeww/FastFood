const jwt = require('jsonwebtoken'); //autenticazione JWT (protezione delle rotte, token valido per visualizzare certe pagine )

// Import configurazione condivisa
const { ROLES } = require('../../client/js/config');


function generaToken(dati){
    return jwt.sign(dati, process.env.JWT_SECRET, { expiresIn: '1d' });
}

function autenticaToken(req, res, next){ //controlla se il token esiste, autentica
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Token non trovato' });
    }
     /*
     jwt.verify prende il token e la chiave segreta (process.env.JWT_SECRET).hiama il callback (funzione con due parametri ).
     vengono riempiti in base a se è NON valido ( err ) o valido( user ) con err=null
     */
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token non valido' });
        }
        req.user = user;
        next();
    }); 

}

function checkCliente(req, res, next) { //middleware controllo del ruolo cliente
    if (!req.user) {
    return res.status(401).json({ message: 'Token mancante o non valido' });
  }

    if(req.user.ruolo  != ROLES.CLIENTE){
        return res.status(401).json({ message: 'Accesso negato. Non sei un cliente' });
    }
    next();
};

function checkRistorante(req, res, next) { //middleware controllo del ruolo ristorante
    if (!req.user) {
    return res.status(401).json({ message: 'Token mancante o non valido' });
  }

    if(req.user.ruolo  != ROLES.RISTORANTE){
        return res.status(401).json({ message: 'Accesso negato. Non sei un ristorante' });
    }

    
    next();
};

module.exports = { autenticaToken, generaToken, checkRistorante, checkCliente }; 