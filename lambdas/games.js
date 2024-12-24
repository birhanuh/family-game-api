const express = require('express');
const AWS = require('aws-sdk');
const shortid = require('shortid');
const cors = require('cors');

// app
const app = express();

// env
require('dotenv').config();

const corsOptions = {
  origin: ['http://localhost:3001/', 'https://family-game.netlify.app/', 'https://family.ellariam.com/'],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// CORS
app.use(cors(corsOptions));

/** Using env file is not working in AWS */
// const NODE_ENV = process.env.NODE_ENV;
// const GAMES_TABLE = process.env.GAMES_TABLE;

const NODE_ENV = 'production';
const GAMES_TABLE = 'games-table-dev';

// app.use(function (req, res, next) {
//   res.setHeader("Access-Control-Allow-Origin", "https://family-game.netlify.app/");
//   next();
// })


const dynamodb = NODE_ENV === 'dev' ? new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  }): new AWS.DynamoDB.DocumentClient();


// Get Games endpoint
app.get('/', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Select: 'ALL_ATTRIBUTES',
    KeyConditions: {
      Status: {
        ComparisonOperator: 'EQ',
        AttributeValueList: ['OK'],
      },
    },
    ScanIndexForward: false,
  };

  dynamodb.scan(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get games' });
    }
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Games not found' });
    }
  });
});

// Get Game endpoint
app.get('/get/:gameId', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  };

  dynamodb.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get game' });
    }
    if (result.Item) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  });
});

// Create Game endpoint
app.post('/create', function (req, res) {
  const { title } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Item: {
      gameId: shortid.generate(),
      title: title,
      questions: [],
      players: [],
      winner: {},
    },
  };

  dynamodb.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json({ gameId: params.Item.gameId, winner: {}, title, players: [], questions: [] });
  });
});

// Update Game endpoint
app.put('/:gameId/update', function (req, res) {
  const { title, winner } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: 'SET title = :t, winner = :w',
    ExpressionAttributeValues: {
      ':t': title,
      ':w': winner,
    },
    ReturnValues: 'ALL_NEW',
  };

  dynamodb.update(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json(result);
  });
});

// Reset Game endpoint
app.put('/:gameId/reset', async function (req, res) {
  const result = await dynamodb.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();

  // Reset players
  const playersReseted = result.Item.players.map((player) => {
    player.score = 0;

    return player;
  });

  // Reset questions
  const questionsReseted = result.Item.questions.map((question) => {
    question.isAsked = false;

    return question;
  });

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `SET winner = :w, players = :pls, questions = :qts`,
    ExpressionAttributeValues: {
      ':w': {},
      ':pls': playersReseted,
      ':qts': questionsReseted,
    },
    ReturnValues: 'ALL_NEW',
  };

  dynamodb.update(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json(result);
  });
});

// Delete Game endpoint
app.post('/delete/:gameId', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  };

  dynamodb.delete(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete game' });
    }

    if (result.Item) {
      const { title } = result.Item;
      res.json(`Game ${title} is deleted!`);
    }
  });
});

/** QUESTION */
// Add Question endpoint
app.put('/:gameId/questions/add', function (req, res) {
  const { question } = req.body;

  if (typeof question !== 'string') {
    res.status(400).json({ error: '"question" must be a string' });
  }

  // Short id
  const shortId = shortid.generate();

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    ExpressionAttributeNames: {
      '#Y': 'questions',
    },
    UpdateExpression: 'SET #Y = list_append(#Y,:y)',
    ExpressionAttributeValues: {
      ':y': [{ questionId: shortId, question, isAsked: false }],
    },
  };

  dynamodb.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create question' });
    }

    res.json({ gameId: req.params.gameId, questionId: shortId, question, isAsked: false });
  });
});

// Update Question endpoint
app.put('/:gameId/questions/:questionId/update', async function (req, res) {
  const { question, isAsked } = req.body;

  if (typeof question !== 'string') {
    res.status(400).json({ error: '"question" must be a string' });
  }

  if (typeof isAsked !== 'boolean') {
    res.status(400).json({ error: '"isAsked" must be a boolean' });
  }

  const result = await dynamodb.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();

  // find the index
  const indexToUpdate = findWithAttr(result.Item.questions, 'questionId', req.params.questionId);
  if (indexToUpdate === -1) {
    // element not found
    res.status(400).json({ error: 'Question not found' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `SET questions[${indexToUpdate}] = :valueToUpdate`,
    ExpressionAttributeValues: {
      ':valueToUpdate': { questionId: req.params.questionId, question, isAsked },
    },
  };

  dynamodb.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update question' });
    }

    res.json({ gameId: req.params.gameId, questionId: req.params.questionId, question, isAsked });
  });
});

// Delete Question endpoint
app.delete('/:gameId/questions/:questionId/delete', async function (req, res) {
  const result = await dynamodb.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();
  console.log('DS: ', result.Item, req.params);
  // find the index
  const indexToRemove = findWithAttr(result.Item.questions, 'questionId', req.params.questionId);
  console.log('ID: ', indexToRemove);
  if (indexToRemove === -1) {
    // element not found
    res.status(400).json({ error: 'Question not found' });
  } else {
    const params = {
      TableName: GAMES_TABLE,
      Key: {
        gameId: req.params.gameId,
      },
      UpdateExpression: `REMOVE questions[${indexToRemove}]`,
    };

    dynamodb.update(params, (error) => {
      if (error) {
        console.log(error);
        res.status(400).json({ error: 'Could not delete question' });
      }

      res.json({ gameId: req.params.gameId, questionId: req.params.questionId });
    });
  }
});

/** PLAYER */
// Add Player endpoint
app.put('/:gameId/players/add', function (req, res) {
  const { name } = req.body;

  if (typeof name !== 'string') {
    res.status(400).json({ error: '"name" must be a string' });
  }

  // Short id
  const shortId = shortid.generate();

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    ExpressionAttributeNames: {
      '#Y': 'players',
    },
    UpdateExpression: 'SET #Y = list_append(#Y,:y)',
    ExpressionAttributeValues: {
      ':y': [{ playerId: shortId, name, score: 0 }],
    },
  };

  dynamodb.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create player' });
    }

    res.json({ gameId: req.params.gameId, playerId: shortId, name, score: 0 });
  });
});

// Update Player endpoint
app.put('/:gameId/players/:playerId/update', async function (req, res) {
  const { name, score } = req.body;

  if (typeof name !== 'string') {
    res.status(400).json({ error: '"name" must be a string' });
  }

  if (typeof score !== 'number') {
    res.status(400).json({ error: '"score" must be a number' });
  }

  const result = await dynamodb.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();

  // find the index
  const indexToUpdate = findWithAttr(result.Item.players, 'playerId', req.params.playerId);
  if (indexToUpdate === -1) {
    // element not found
    res.status(400).json({ error: 'Player not found' });
  } else {
    const params = {
      TableName: GAMES_TABLE,
      Key: {
        gameId: req.params.gameId,
      },
      UpdateExpression: `SET players[${indexToUpdate}] = :valueToUpdate`,
      ExpressionAttributeValues: {
        ':valueToUpdate': { playerId: req.params.playerId, name, score },
      },
    };

    dynamodb.update(params, (error) => {
      if (error) {
        console.log(error);
        res.status(400).json({ error: 'Could not update player' });
      }

      res.json({ gameId: req.params.gameId, playerId: req.params.playerId, name, score });
    });
  }
});

// Delete Player endpoint
app.delete('/:gameId/players/:playerId/delete', async function (req, res) {
  const result = await dynamodb.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();

  // find the index
  const indexToRemove = findWithAttr(result.Item.players, 'playerId', req.params.playerId);
  if (indexToRemove === -1) {
    // element not found
    res.status(400).json({ error: 'Player not found' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `REMOVE players[${indexToRemove}]`,
  };

  dynamodb.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete player' });
    }

    res.json({ gameId: req.params.gameId, playerId: req.params.playerId });
  });
});

module.exports = app;

function findWithAttr(array, attr, value) {
  for (var i = 0; i < array.length; i += 1) {
    if (array[i][attr] === value) {
      return i;
    }
  }
  return -1;
}
