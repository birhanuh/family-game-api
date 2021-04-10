const express = require('express')
const AWS = require('aws-sdk');
const shortid = require('shortid');

const authenticate = require('../middlewares/authenticate');

const GAMES_TABLE = process.env.GAMES_TABLE;
const IS_OFFLINE = process.env.IS_OFFLINE;

let DynamoDB;
if (IS_OFFLINE) {
  DynamoDB = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  })
} else {
  DynamoDB = new AWS.DynamoDB.DocumentClient();
};

const router = express.Router();

/** PLAYER */
// Create Player endpoint
router.put('/:gameId/players/create', function (req, res) {
  const { name } = req.body;

  if (typeof name !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    ExpressionAttributeNames: {
      "#Y": "players"
    },
    UpdateExpression: "SET #Y = list_append(#Y,:y)",
    ExpressionAttributeValues: {
      ":y": [{ playerId: shortid.generate(), name, score: 0 }]
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create player' });
    }

    res.json({ playerId: shortid.generate(), name, score: 0 });
  });
})

// Update Player endpoint
router.put('/:gameId/players/:playerId/update', async function (req, res) {
  const { name, score } = req.body;

  if (typeof name !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  if (typeof score !== 'number') {
    res.status(400).json({ error: '"score" must be a number' });
  }

  const result = await DynamoDB.get({
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
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `SET players[${indexToUpdate}] = :valueToUpdate`,
    ExpressionAttributeValues: {
      ":valueToUpdate": { playerId: req.params.playerId, name, score }
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update player' });
    }

    res.json({ playerId: req.params.playerId, name, score });
  });
})

// Delete Player endpoint
router.put('/:gameId/players/:playerId/delete', async function (req, res) {
  const result = await DynamoDB.get({
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
    UpdateExpression: `REMOVE players[${indexToRemove}]`
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete player' });
    }

    res.json({ playerId: req.params.playerId });
  });
})

module.exports = router;

function findWithAttr(array, attr, value) {
  for (var i = 0; i < array.length; i += 1) {
    if (array[i][attr] === value) {
      return i;
    }
  }
  return -1;
}