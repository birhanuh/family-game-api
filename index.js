const serverless = require('serverless-http');
const express = require('express');
const app = express();

// env
require("dotenv").config();

// controllers
// const users = require('./controllers/users');
const games = require('./controllers/games');

app.use(express.json());

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