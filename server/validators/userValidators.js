const { body, validationResult } = require('express-validator');

//.optional() controlla solo se inserito, altrimenti no (opzionale)
//trim() toglie eventuali spazi inseriti in testa e in coda
//escape() toglie eventuali caratteri speciali come <, >, ecc
//isLength() controlla la lunghezza del campo

//middlewares per controllare dati in ingresso
const validateRegister = [

    // campi obbligaotri per entrambi cliente e ristorante
    body('ruolo')
        .trim().escape()
        .isIn(['cliente', 'ristorante'])
        .withMessage("Il ruolo deve essere 'cliente' o 'ristorante'"),

    body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Email non valida')
        .isLength({ min: 5, max: 50 })
        .withMessage("L'email deve avere tra 5 e 50 caratteri"),

    body('password')
        .trim()
        .isLength({ min: 6, max: 50})
        .withMessage('La password deve contenere tra 6 e 50 caratteri'),

    // ---- campi cliente obbligatori------ ---
    body('nome')
        .if(body('ruolo').equals('cliente'))
        .trim()
        .escape()
        .isLength({ min: 2, max: 30 })
        .withMessage('Il nome deve contenere tra 2 e 30 caratteri'),

    body('cognome')
        .if(body('ruolo').equals('cliente'))
        .trim()
        .escape()
        .isLength({ min: 2, max: 30 })
        .withMessage('Il cognome deve contenere tar 2 e 30 caratteri'),

    // ---------- campi ristorante obbligatori ------------
    body('nomeRistorante')
        .if(body('ruolo').equals('ristorante'))
        .trim()
        .escape()
        .isLength({ min: 3, max: 50 })
        .withMessage('Il nome del ristorante deve contenere tra 3 e 50 caratteri'),

    body('partitaIVA')
        .if(body('ruolo').equals('ristorante'))
        .trim()
        .escape()
        .matches(/^[0-9]{11}$/)
        .withMessage('La Partita IVA deve contenere 11 cifre numeriche'),

    // ----------- campi opzionali per ristorante --------------
    body('indirizzo')
        .optional()
        .trim()
        .escape()
        .isLength({ min: 5, max: 100 })
        .withMessage("L'indirizzo deve contenere tra 5 e 100 caratteri"),

    body('categoria')
        .optional()
        .trim()
        .escape()
        .isLength({ min: 3, max: 50 })
        .withMessage('La categoria deve contenere tra 3 e 50 caratteri'),

    body('descrizione')
        .optional()
        .trim()
        .escape()
        .isLength({ min: 5, max: 200 })
        .withMessage('La descrizione deve contenere tra 5 caratteri e 200 caratteri'),

    // ---------- campi opzionali per cliente -------------
    //preferenze è un campo opzionale,potrei metterlo anche nella registrzione con un modal.
    // per ora si trova nel profilo
    body('preferenze')
        .optional()
        .isArray()
        .withMessage('Le preferenze devono essere un array di stringhe'),

    //stessa cosa per i pagamenti
    /*
      body('metodoPagamento')
      .optional()
      .trim()
      .isIn(['contanti', 'paypal', 'carta'])
      .withMessage("Il metodo di pagamento deve essere 'contanti', 'paypal' o 'carta'"),

    body('paypalEmail')
      .if(body('metodoPagamento').equals('paypal'))
      .notEmpty()
      .withMessage('Email PayPal obbligatoria se il metodo è PayPal')
      .isEmail()
      .withMessage('Email PayPal non valida')
      .isLength({ min: 5, max: 50 })
      .withMessage("L'email paypal deve avere tra 5 e 50 caratteri"),

    body('cartaNumero')
      .if(body('metodoPagamento').equals('carta'))
      .notEmpty()
      .withMessage('Numero carta obbligatorio se il metodo è Carta')
      .matches(/^[0-9]{16}$/)
      .withMessage('Il numero carta deve avere 16 cifre'),

    body('paypalEmail')
      .if(body('metodoPagamento').not().equals('paypal'))
      .custom((value) => !value) 
      .withMessage('Email PayPal non ammessa se il metodo non è PayPal'),

    body('cartaNumero')
      .if(body('metodoPagamento').not().equals('carta'))
      .custom((value) => !value)
      .withMessage('Numero carta non ammesso se il metodo non è Carta'),
    */

    // ------------ telefono opzionale per entrambi --------------
    body('telefono')
        .optional()
        .trim()
        .escape()
        .isMobilePhone('it-IT')
        .withMessage('Numero di telefono non valido')
];

const validateLogin = [
    body('email').trim().normalizeEmail().isEmail().withMessage('Email non valida').isLength({ min: 5, max: 50 }).withMessage("L'email deve avere tra 5 e 50 caratteri"),
    body('password').trim().isLength({ min: 6, max: 50 }).withMessage('La password deve contenere tra 6 e 50 caratteri')
];


//-----------validare update dei dati (tutto opzionale) -----------

const validateUpdate = [

  /*
  body('email')
    .optional()
    .isEmail().withMessage('Email non valida')
    .isLength({ min: 5 }).withMessage('Email troppo corta'),
  */

  body('password')
    .optional()
    .isLength({ min: 6 }).withMessage('La password deve avere almeno 6 caratteri'),

  body('nome')
    .optional()
    .isLength({ min: 3 }).withMessage('Il nome deve avere almeno 3 caratteri'),

  body('cognome')
    .optional()
    .isLength({ min: 3 }).withMessage('Il cognome deve avere almeno 3 caratteri'),

  body('nomeRistorante')
    .optional()
    .isLength({ min: 3 }).withMessage('Il nome del ristorante deve avere almeno 3 caratteri'),

  body('partitaIVA')
    .optional()
    .isLength({ min: 8 }).withMessage('Partita IVA troppo corta'),

  body('telefono')
    .optional()
    .isLength({ min: 7 }).withMessage('Numero di telefono troppo corto'),

  body('descrizione')
    .optional()
    .isLength({ min: 5 }).withMessage('La descrizione deve avere almeno 5 caratteri'),

  body('preferenze')
    .optional()
    .isArray()
    .withMessage('Le preferenze devono essere un array di stringhe'),

  // URL immagine profilo ristorante (opzionale). Non forziamo pattern complicati, controllo lunghezza minima.
  body('immagine')
    .optional()
    .isString()
    .isLength({ min: 5, max: 300 })
    .withMessage('URL immagine non valido'),

    /*
  body('metodiPagamento')
    .optional()
    .isIn(['contanti', 'paypal', 'carta'])
    .withMessage("Il metodo di pagamento deve essere 'contanti', 'paypal' o 'carta'"),
  
  body('paypalEmail')
    .if(body('metodoPagamento').equals('paypal'))
    .optional()
    .isEmail()
    .withMessage('Email PayPal non valida')
    .isLength({ min: 5, max: 50 })
    .withMessage("L'email paypal deve avere tra 5 e 50 caratteri"),

  body('cartaNumero')
    .if(body('metodoPagamento').equals('carta'))
    .optional()
    .matches(/^[0-9]{16}$/)
    .withMessage('Il numero carta deve avere 16 cifre'),
  
  body('paypalEmail')
      .if(body('metodoPagamento').not().equals('paypal'))
      .custom((value) => !value) 
      .withMessage('Email PayPal non ammessa se il metodo non è PayPal'),

  body('cartaNumero')
    .if(body('metodoPagamento').not().equals('carta'))
    .custom((value) => !value)
    .withMessage('Numero carta non ammesso se il metodo non è Carta')

    */

    //versione migliorata.
    //da migliorare, accetta campi di altri tipi
    body('metodiPagamento')
      .optional()
      .isArray().withMessage('I metodi di pagamento devono essere un array'),

    body('metodiPagamento.*.tipo') //* considera ogni elemento dell'array
      .optional()
      .isIn(['carta', 'paypal', 'contanti'])
      .withMessage("Il tipo di pagamento deve essere 'carta', 'paypal' o 'contanti'"),

    body('metodiPagamento.*').custom(value => {
      if (value.tipo === 'carta') {
        if (!value.numeroMascherato) throw new Error('Numero carta obbligatorio');
        if (!value.circuito) throw new Error('Circuito obbligatorio');
      }
      if (value.tipo === 'paypal') {
        if (!value.emailPaypal) throw new Error('Email PayPal obbligatoria');
      }
      return true;
    })
    
];

const validatePswUpdate = [
  body('oldPassword')
    .notEmpty()
    .withMessage('La vecchia password è obbligatoria'),

  body('newPassword')
    .notEmpty()
    .withMessage('La nuova password è obbligatoria')
    .isLength({ min: 6 }).withMessage('La nuova password deve avere almeno 6 caratteri')
    // opzionale: regole extra
    //.matches(/[A-Z]/).withMessage('Deve contenere almeno una lettera maiuscola')
    //.matches(/[a-z]/).withMessage('Deve contenere almeno una lettera minuscola')
    //.matches(/[0-9]/).withMessage('Deve contenere almeno un numero')
];

// --- funzione middleware per gestire errori, li formatta e li restituisce in JSON ---
const handleValidationErr = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(' Errori di validazione:', errors.array());
    // restituisce un JSON con { campo: messaggio }
    const formattedErrors = errors.array().map(err => ({
      campo: err.param,
      messaggio: err.msg
    }));
    console.log('📤 Errori formattati inviati al client:', formattedErrors);
    return res.status(400).json({ errori: formattedErrors });
  }
  next();
};

module.exports = { validateRegister, validateLogin, validateUpdate, validatePswUpdate, handleValidationErr };