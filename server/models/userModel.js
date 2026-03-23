const mongoose = require('mongoose');

// Import configurazione condivisa
const { ROLES } = require('../../client/js/config');

const menuItemSchema = new mongoose.Schema({
    piattoComuneId: { type: String },
    piattoPersonalizzato: { type: Boolean, default: false },
    strMeal: { type: String },
    ingredients: [{ type: String }],
    strCategory: { type: String },
    strMealThumb: { type: String },
    prezzo: { type: Number, required: true },
});

const paymentMethodSchema = new mongoose.Schema({
  //se un metodo di pagamenti viene aggiunto, il tipo è obblgatorio
    tipo: { type: String, enum : ['carta', 'paypal', 'contanti'], required: true },    // carta | paypal | contanti
    circuito: { type: String },
    numeroMascherato: { type: String }, //Solo per carte
    emailPaypal: { type: String },     //solo per paypal
    predefinito: { type: Boolean, default: false } // indica se è quello di default
});

/*
piatto comune: menu del ristorante non contiene i dati completi dei piatti comuni, solo il riferimento e il prezzo!!
 il resto viene recuperato facendo query al database comune

mentre il prezzo è nel menu del ristorante (varia da piatto a piatto).

invece quando inserisce un piatto personalizzato, compilerà tutti i campi.
*/

const userSchema = new mongoose.Schema({
  ruolo: { type: String, enum: ['cliente', 'ristorante'], required: true },

  // campi ristorante
    nomeRistorante: { //se ruolo è ROLES.RISTORANTE, this.ruolo === ROLES.RISTORANTE -> true --> required attivo.
      type: String,  required: function () { return this.ruolo === ROLES.RISTORANTE; } },
    partitaIVA: { 
      type: String, required: function () { return this.ruolo === ROLES.RISTORANTE; }},
    indirizzo: { type: String },
    categoria: { type: String },
    descrizione: { type: String },
    immagine: { type: String }, // URL immagine profilo ristorante
    menu: [menuItemSchema], // array di piatti, sia comuni che personalizzati

  // campi cliente
    nome: { type: String, required: function () { return this.ruolo === ROLES.CLIENTE; } },
    cognome: { type: String, required: function () { return this.ruolo === ROLES.CLIENTE; } },
    preferenze: [{ type: String }],
    metodiPagamento : [paymentMethodSchema],

  // campi comuni
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    telefono: { type: String }
});

module.exports = mongoose.model('User', userSchema);
