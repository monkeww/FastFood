const argon2 = require('argon2');


// x registrazione
async function hashPassword(password) {
    const hash = await argon2.hash(password); //crea l'hash della password che salvo nel db 
    return hash;
}

// x login 
async function checkPassword(password, hash) {
    if( await argon2.verify(hash, password)){
        return true;        //la password matcha l'hash salvato  --> andro a creare il jwt token
    }
        return false;
    
}

module.exports = { hashPassword, checkPassword }


