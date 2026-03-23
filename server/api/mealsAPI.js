const express = require('express');
const router = express.Router();

const { connect } = require('../config/db'); //con mongoose apre la connessione da solo
const { close } = require('../config/db');
//const Meal = require('../models/meal');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const Meal = require('../models/mealModel');

const { checkRistorante, autenticaToken } = require('../utils/jwt');

//attenzione ordine delle rotte...
//router.get('/meals/:id', ...)      questa cattura TUTTO
//router.get('/meals/search', ...)   mai raggiunta.  Rotte specifiche come search PRIMA di quelle con parametri dinamici

//router.use(autenticaToken);

//è l'endpoint (quindi risponde quando faccio GET su /meals).
//checkRistorante controlla req.user.ruolo,ma req.user viene creato dentro autenticaToken, ordine corretto:
router.get('/meals', autenticaToken, checkRistorante, async (req, res) => { 
    /* VERSIONE MONGOCLIENT 
    try {
        const db = await connect();
        const meals = await db.collection('meals').find().toArray();
        res.json(meals);
        //npomawait close();
    } catch (err) {
        console.error('❌ Errore connessione MongoDB:', err);
        process.exit(1); // termina il processo in caso di errore
    }
        */

    try{
        const meals = await Meal.find();
        res.json({ 
            success: true, count: meals.length,
            meals 
        });
    }catch(err){
        console.error('❌ Errore recupero dei meals:', err);
        res.status(500).json({ success: false, error: '❌ Errore recupero dei meals' });
        //process.exit(1); // termina il processo in caso di errore
    }
});


// ..../meals/search?q=pizza - ricerca piatti per nome E/O CATEGORIA
router.get('/meals/search', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const { q, category, area } = req.query;

        if (!q && !category && !area) {
            return res.status(400).json({ 
                success: false,
                message: 'Fornisci almeno un parametro: q(nome), category(categoria) o area(origine)' 
            });
        }

        let filtro = {};

        if (q) {
            filtro.strMeal = { $regex: new RegExp(q, 'i') };
        }
        if (category) {
            filtro.strCategory = { $regex: new RegExp(category, 'i') };
        }
        if (area) {
            filtro.strArea = { $regex: new RegExp(area, 'i') };
        }

        const meals = await Meal.find(filtro);

        res.json({ 
            success: true,
            filters:{
                nome: q || null,
                categoria: category || null,
                origine: area || null
            },
            count: meals.length,
            meals 
        });
    } catch (err) {
        console.error('❌ Errore ricerca piatti:', err);
        res.status(500).json({ success: false, error: 'Errore ricerca piatti' });
    }
});


router.get('/meals/categories', autenticaToken, async (req, res) => {
    try {
        // Trova tutte le categorie uniche
        const categories = await Meal.distinct('strCategory');

        res.json({ 
            success: true,
            count: categories.length,
            categories 
        });
    } catch (err) {
        console.error('❌ Errore recupero categorie:', err);
        res.status(500).json({ success: false, error: 'Errore recupero categorie' });
    }
});


router.get('/meals/category/:category', autenticaToken, async (req, res) => {
    try {
        const { category } = req.params;
        
        // controlla se la categoria esiste
        const categorieDisponibili = await Meal.distinct('strCategory');
        
        const categoriaEsiste = categorieDisponibili.some(
            cat => cat.toLowerCase() === category.toLowerCase()
        );
        
        if (!categoriaEsiste) {
            return res.status(404).json({ 
                success: false,
                message: `Categoria "${category}" non trovata`,
                categorieDisponibili: categorieDisponibili
            });
        }
        
        // se esiste allora cerca i piatti nella categoria
        const meals = await Meal.find({ 
            strCategory: { $regex: new RegExp(category, 'i') } 
        });

        res.json({ 
            success: true,
            category: category,
            count: meals.length,
            meals 
        });
    } catch (err) {
        console.error('❌ Errore recupero piatti per categoria:', err);
        res.status(500).json({ success: false,error: 'Errore recupero piatti per categoria' });
    }
});


// .../meals/random?count=5 piatti casuali, suggerimenti con un contatore.
router.get('/meals/random', autenticaToken, checkRistorante, async (req, res) => {
    try {
        const count = parseInt(req.query.count) || 5;
        
        //  aggregation di mongodb per prendere documenti casuali
        const meals = await Meal.aggregate([
            { $sample: { size: count } }
        ]);

        res.json({ 
            success: true,
            count: meals.length,
            meals 
        });
    } catch (err) {
        console.error('❌ Errore recupero piatti casuali:', err);
        res.status(500).json({ success: false, error: 'Errore recupero piatti casuali' });
        }

});



// endpoint dettaglio singolo piatto - accessibile a tutti gli utenti autenticati (clienti e ristoranti)
router.get('/meals/:id', autenticaToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // cerca per idMeal (non per _id di MongoDB)
        const meal = await Meal.findOne({ idMeal: id });
        
        if (!meal) {
            return res.status(404).json({ success: false, message: 'Piatto non trovato' });
        }

        res.json({ 
            success: true,
            meal 
        });
    } catch (err) {
        console.error('❌ Errore recupero piatto:', err);
        res.status(500).json({  success: false, error: 'Errore recupero piatto' });
    }
});



module.exports = router;