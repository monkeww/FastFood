const mongoose = require('mongoose');

// Import configurazione condivisa
const { ORDER_STATES } = require('../../client/js/config');

// schema per un singolo item del carrello
const cartItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId }, // ID del piatto nel menu del ristorante
  piattoComuneId: { type: String },           // riferimento al piatto comune
  piattoPersonalizzato: { type: Boolean },   // true se è un piatto creato dal ristorante
  strMeal: { type: String },                 // nome del piatto (per piatti personalizzati)
  ingredients: [{ type: String }],           
  strCategory: { type: String },             
  strMealThumb: { type: String },           
  prezzo: { type: Number, required: true }, 
  quantita: { type: Number, default: 1 }     // quantità
});

// schema per il carrello
const cartSchema = new mongoose.Schema({
  utenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ristoranteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // solo ristoranti
  items: [cartItemSchema],                  // array di items
  /*
  stato: { type: String, enum: ['in preparazione', 'consegnato', 'ritirabile'], default: 'in preparazione' },
  tempoAttesa: { type: Number, default: 0 }, // minuti stimati
  dataCreazione: { type: Date, default: Date.now } // timestamp della creazione
  */
});

module.exports = mongoose.model('Cart', cartSchema);