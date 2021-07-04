const serverless = require('serverless-http');
const express = require('express');

// app
const app = express();

// env
require("dotenv").config();

// get body as json
app.use(express.json());

// controllers
// const users = require('./controllers/users');
const games = require('./controllers/games');

// CORS
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "Content-Type");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", true);

  next();
});

app.get('/', function (req, res) {
  res.send('Hello World!')
});

// app.use('/users', users);
app.use('/games', games);

module.exports.handler = serverless(app);