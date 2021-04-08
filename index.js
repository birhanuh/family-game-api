const serverless = require('serverless-http');
const express = require('express');
const app = express();

require("dotenv/config");

// env
require("dotenv").config();

// controllers
// const users = require('./controllers/users');
const games = require('./controllers/games');

app.use(express.json());

app.get('/', function (req, res) {
  res.send('Hello World!')
});

// app.use('/users', users);
app.use('/games', games);

module.exports.handler = serverless(app);