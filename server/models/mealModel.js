const mongoose = require('mongoose');

/*
const mealSchema = new mongoose.Schema({
    piattoComuneId: { type: String },
    piattoPersonalizzato: { type: Boolean, default: false },
    strMeal: { type: String },
    ingredients: [{ type: String }],
    strCategory: { type: String },
    strMealThumb: { type: String },
    prezzo: { type: Number, default: 0.0,  required: true },
});

*/

const mealSchema = new mongoose.Schema({
  idMeal: String,
  strMeal: String,
  strCategory: String,
  strArea: String,
  strMealThumb: String,
  strTags: String,
  ingredients: [String],
});

module.exports = mongoose.model('Meal', mealSchema, 'meals'); //forzatura nome meals della colelzione