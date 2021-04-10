const express = require('express')
const AWS = require('aws-sdk');
const shortid = require('shortid');

const authenticate = require('../middlewares/authenticate');

const USERS_TABLE = process.env.USERS_TABLE;
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

/** USER */
// Create Game endpoint
router.put('/:userId/create', function (req, res) {
  const { title } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
    ExpressionAttributeNames: {
      "#Y": "games"
    },
    UpdateExpression: "SET #Y = list_append(#Y,:y)",
    ExpressionAttributeValues: {
      ":y": [{ gameId: shortid.generate(), title }]
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json({ gameId: shortid.generate(), title });
  });
})

// Update Game endpoint
router.put('/:userId/games/:gameId/update', async function (req, res) {
  const { title, score } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  if (typeof score !== 'number') {
    res.status(400).json({ error: '"score" must be a number' });
  }

  const result = await DynamoDB.get({
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  }).promise();

  // find the index
  const indexToUpdate = findWithAttr(result.Item.games, 'gameId', req.params.gameId);
  if (indexToUpdate === -1) {
    // element not found
    res.status(400).json({ error: 'Game not found' });
  }

  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
    UpdateExpression: `SET games[${indexToUpdate}] = :valueToUpdate`,
    ExpressionAttributeValues: {
      ":valueToUpdate": { gameId: req.params.gameId, title, score }
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update game' });
    }

    res.json({ gameId: req.params.gameId, title, score });
  });
})

// Delete Game endpoint
router.put('/:userId/games/:gameId/delete', async function (req, res) {
  const result = await DynamoDB.get({
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  }).promise();

  // find the index
  const indexToRemove = findWithAttr(result.Item.games, 'gameId', req.params.gameId);
  if (indexToRemove === -1) {
    // element not found
    res.status(400).json({ error: 'Game not found' });
  }

  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
    UpdateExpression: `REMOVE games[${indexToRemove}]`
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete game' });
    }

    res.json({ gameId: req.params.gameId });
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