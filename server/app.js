require('dotenv').config(); //crea variabili da .env e mette a disposizione in process.env 

const express = require('express'); //Framework per creare server node
const cookieParser = require('cookie-parser'); //Il token può essere inviato al client come cookie res.cookie(....)
const cors = require('cors');  //per gestire le richieste al server da altre fonti oltre a localhost
const mongoose = require('mongoose'); //per gestire mongodb 
const swaggerUi = require('swagger-ui-express');
//const cron = require('node-cron'); //utilizzato in utils/orderTimer.js
const swaggerDocument = require('./docs/swagger.json');
//const { connect } = require('./config/db'); //per mongoclient
//const { close } = require('./config/db'); per mongoclient
const connectDB = require('./config/db');
const { startOrderTimer } = require('./utils/orderTimer');
const app = express();

// CORS configurato correttamente per gestire credentials
app.use(cors({
    origin: true, // Accetta qualsiasi origine (per sviluppo)
    credentials: true // Permette l'invio di cookie
}));

app.use(express.json()); //dice a express di usare json come formato di comunicazione. corpo richieste json conv in  req.body,
app.use(cookieParser()); 
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.static('../client')); // Percorso corretto: vai indietro di una cartella
app.use('/uploads', express.static('uploads')); // Serve le immagini caricate

connectDB();

// avvia il timer per gestire gli ordini automaticamente
startOrderTimer();

//APIs
app.use(require('./api/userAPI'));
app.use(require('./api/restaurantsAPI'));
app.use(require('./api/mealsAPI'));
app.use(require('./api/menuAPI'));
app.use(require('./api/cartAPI'));
app.use(require('./api/orderAPI'));
app.use(require('./api/uploadAPI'));
// rotta per test
app.get('/', (req, res) => {
  res.send('Server attivo.');
});

    // avvio del server su 3000 dopo aver collegato le rotte
const PORT = process.env.PORT || 3000; //su una porta diversa da mondogb (27017 di default), mette 30000 in caso non recupera da process.env
app.listen(PORT, () => { //express in ascolto
  console.log(`🚀 Server in ascolto sulla porta ${PORT}`);
});
/*

async function startServer() {
  try {
    //console.log('Testing connection string:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, { // tentativo connessione a mongodb atlas
      // facoltativo 
      // dbName: process.env.DB_NAME, // nome del database definito gia nel .env
    });

    console.log('✅ Connesso a MongoDB');

    // rotta per test
    app.get('/', (req, res) => { 
      res.send('Server attivo.');
    });

    // avvio del server su 30000
    const PORT = process.env.PORT || 30000; //su una porta diversa da mondogb (27017 di default), mette 30000 in caso non recupera da process.env
    app.listen(PORT, () => { //express in ascolto
      console.log(`🚀 Server in ascolto sulla porta ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Errore connessione MongoDB:', err);
    process.exit(1); // termina il processo in caso di errore
  }
}

startServer(); //avvio

*/





