const mongoose = require('mongoose');

// Import configurazione condivisa
const { ORDER_STATES } = require('../../client/js/config');

const orderItemSchema = new mongoose.Schema({
    piattoPersonalizzato: { type: Boolean, default: false },
    strMeal: { type: String, required: true, default: 'Piatto senza nome' },
    ingredients: [{ type: String }],
    piattoComuneId: { type: String },
    menuItemId: { type: mongoose.Schema.Types.ObjectId },
    immagine: { type: String },
    categoria: { type: String },
    prezzo: { type: Number, required: true },
    quantita: { type: Number, required: true, default: 1 },
});

const paymentSchema = new mongoose.Schema({
    tipo: { type: String },    // carta | paypal | contanti
    circuito: { type: String },
    numeroMascherato: { type: String }, //Solo per carte
    emailPaypal: { type: String }     //solo per paypal
});

const orderSchema = new mongoose.Schema({ //schema con due opzioni
    orderId: { type: String }, // opzionale, ma id piu leggibile dall utente. generare n progressivo nelle api
    utenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ristoranteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    piatti: [orderItemSchema],
    metodoPagamentoUsato: paymentSchema,
    tipoOrdine: { 
        type: String, 
        enum: ['ritiro', 'domicilio'], 
        default: 'ritiro' 
    }, // ritiro = cliente ritira in loco, domicilio = consegna a casa (non implementato)
    stato: { 
        type: String, 
        enum: Object.values(ORDER_STATES), 
        default: ORDER_STATES.ORDINATO 
    },
    //createdAt: { type: Date, default: Date.now }   campo statico
    tempoAttesa: { type: Number }, // minuti impostati dal ristorante
    tempoConsegnaStimato: { type: Date } // data e ora quando l'ordine sarà pronto
}, { timestamps: true });   //crea due attrbuti createdAt e updatedAt in automatico (data e ora ). 
                            //messo come opzione dello schema, non campo -> aggiorna auto, altrimenti dovrei gestire manualmente

module.exports = mongoose.model('Order', orderSchema);
