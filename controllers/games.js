const express = require('express')
const AWS = require('aws-sdk');
const shortid = require('shortid');

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

// Get Games endpoint
router.get('/', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Select: "ALL_ATTRIBUTES"
  }

  DynamoDB.scan(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get games' });
    }
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "Games not found" });
    }
  });
})

// Get Game endpoint
router.get('/get/:gameId', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }

  DynamoDB.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get game' });
    }
    if (result.Item) {
      const { gameId, title } = result.Item;
      res.json({ gameId, title });
    } else {
      res.status(404).json({ error: "Game not found" });
    }
  });
})

// Create Game endpoint
router.post('/create', function (req, res) {
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
    },
  };

  DynamoDB.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json({ gameId: params.Item.gameId, title });
  });
})


// Update Game endpoint
router.put('/update/:gameId', function (req, res) {
  const { title } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: 'SET title = :t',
    ExpressionAttributeValues: {
      ':t': title
    },
    // ReturnValues: "UPDATED_NEW"
  };

  DynamoDB.update(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create game' });
    }

    res.json(result);
  });
})

// Create Game endpoint
router.post('/delete/:gameId', function (req, res) {
  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  };

  DynamoDB.delete(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete game' });
    }

    if (result.Item) {
      const { title } = result.Item;
      res.json(`Game ${title} is deleted!`);
    }
  });
})

/** QUESTION */
// Create Question endpoint
router.put('/:gameId/questions/create', function (req, res) {
  const { title } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    ExpressionAttributeNames: {
      "#Y": "questions"
    },
    UpdateExpression: "SET #Y = list_append(#Y,:y)",
    ExpressionAttributeValues: {
      ":y": [{ questionId: shortid.generate(), title, isAnswered: false }]
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create question' });
    }

    res.json({ questionId: shortid.generate(), title, isAnswered: false });
  });
})

// Update Question endpoint
router.put('/:gameId/questions/:questionId/update', async function (req, res) {
  const { title, isAnswered } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  if (typeof isAnswered !== 'boolean') {
    res.status(400).json({ error: '"isAnswered" must be a boolean' });
  }

  const result = await DynamoDB.get({
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
      ":valueToUpdate": { questionId: req.params.questionId, title, isAnswered }
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update question' });
    }

    res.json({ questionId: req.params.questionId, title, isAnswered });
  });
})

// Delete Question endpoint
router.put('/:gameId/questions/:questionId/delete', async function (req, res) {
  const result = await DynamoDB.get({
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
  }).promise();

  // find the index
  const indexToRemove = findWithAttr(result.Item.questions, 'questionId', req.params.questionId);
  if (indexToRemove === -1) {
    // element not found
    res.status(400).json({ error: 'Question not found' });
  }

  const params = {
    TableName: GAMES_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `REMOVE questions[${indexToRemove}]`
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete question' });
    }

    res.json({ questionId: req.params.questionId });
  });
})

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