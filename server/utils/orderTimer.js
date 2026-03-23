const cron = require('node-cron');
const Order = require('../models/orderModel');

// import configurazione condivisa
const { ORDER_STATES } = require('../../client/js/config');

//  gira ogni minuto per controllare gli ordini
const startOrderTimer = () => {
    // esegue ogni minuto: '* * * * *' significa ogni minuto
    cron.schedule('* * * * *', async () => {
        try {
            console.log('⏰ Controllo ordini in preparazione...');
            
            // trova tutti gli ordini in preparazione il cui tempo è scaduto
            const ordiniScaduti = await Order.find({
                stato: ORDER_STATES.IN_PREPARAZIONE,
                tempoConsegnaStimato: { $lte: new Date() } // minore o uguale alla data attuale
            });

            // se scaduto, aggiorna automaticamente lo stato a "pronto"
            for (const ordine of ordiniScaduti) {
                await Order.findByIdAndUpdate(ordine._id, {
                    stato: ORDER_STATES.PRONTO
                });
                
                console.log(`✅ Ordine ${ordine._id} è ora pronto per il ritiro!`);
                
                // notifiche push al cliente
                notifyClient(ordine.utenteId, 'Il tuo ordine è pronto!');
            }

            if (ordiniScaduti.length > 0) {
                console.log(`🔄 Aggiornati ${ordiniScaduti.length} ordini a "pronto"`);
            }

        } catch (error) {
            console.error('❌ Errore nel timer degli ordini:', error);
        }
    });

    setTimeout(() => { //il messaggio dopo 1 secondo per assicurarsi che il timer sia avviato
        console.log('🕓 Timer ordini avviato - controlla ogni minuto');
    }, 1000);
};

module.exports = { startOrderTimer };