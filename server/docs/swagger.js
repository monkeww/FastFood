const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'}); 
//npm run swaggernn per generare lo swagger 
const doc = {
    info: {
      version: '1.0.0',
      title: 'FastFood API',
      description: 'Swagger Docs delle API di FastFood'
    },
    host: 'localhost:30000'
  };

const outputFile = './docs/swagger.json';
const inputFiles = [
  './app.js',           
  './api/*.js', // Include le API 
];

swaggerAutogen(outputFile,inputFiles, doc);


