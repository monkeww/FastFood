require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

// definizione schema Meals (senza instructions, measures, youtube)
const mealSchema = new mongoose.Schema({
  idMeal: String,
  strMeal: String,
  strCategory: String,
  strArea: String,
  strMealThumb: String,
  strTags: String,
  ingredients: [String],
});

const Meal = mongoose.model('Meal', mealSchema);

async function importMeals() {
  try {
    // connessione a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
    });
    console.log('✅ Connesso a MongoDB');

    // lettura file JSON
    const data = fs.readFileSync('meals.json', 'utf-8');
    let meals = JSON.parse(data);

    // rimuoviamo i campi che non vuoi
    meals = meals.map(m => {
      return {
        idMeal: m.idMeal,
        strMeal: m.strMeal,
        strCategory: m.strCategory,
        strArea: m.strArea,
        strMealThumb: m.strMealThumb,
        strTags: m.strTags,
        ingredients: m.ingredients,
      };
    });

    // pulizia collezione (opzionale: così eviti duplicati)
    await Meal.deleteMany({});
    console.log('🗑️ Vecchi meals eliminati');

    // inserimento in DB
    await Meal.insertMany(meals);
    console.log(`🍽️ Importati ${meals.length} meals`);

    process.exit();
  } catch (err) {
    console.error('❌ Errore importazione:', err);
    process.exit(1);
  }
}

importMeals();