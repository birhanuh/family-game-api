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

/** QUESTION */
// Create Question endpoint
router.put('/:gameId/questions/create', function (req, res) {
  const { title } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    ExpressionAttributeNames: {
      "#Y": "questions"
    },
    UpdateExpression: "SET #Y = list_append(#Y,:y)",
    ExpressionAttributeValues: {
      ":y": [{ questionId: shortid.generate(), title, isAsked: false }]
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create question' });
    }

    res.json({ questionId: shortid.generate(), title, isAsked: false });
  });
})

// Update Question endpoint
router.put('/:gameId/questions/:questionId/update', async function (req, res) {
  const { title, isAsked } = req.body;

  if (typeof title !== 'string') {
    res.status(400).json({ error: '"title" must be a string' });
  }

  if (typeof isAsked !== 'boolean') {
    res.status(400).json({ error: '"isAsked" must be a boolean' });
  }

  const result = await DynamoDB.get({
    TableName: USERS_TABLE,
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
    TableName: USERS_TABLE,
    Key: {
      gameId: req.params.gameId,
    },
    UpdateExpression: `SET questions[${indexToUpdate}] = :valueToUpdate`,
    ExpressionAttributeValues: {
      ":valueToUpdate": { questionId: req.params.questionId, title, isAsked }
    },
  };

  DynamoDB.update(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update question' });
    }

    res.json({ questionId: req.params.questionId, title, isAsked });
  });
})

// Delete Question endpoint
router.put('/:gameId/questions/:questionId/delete', async function (req, res) {
  const result = await DynamoDB.get({
    TableName: USERS_TABLE,
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
    TableName: USERS_TABLE,
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

module.exports = router;

function findWithAttr(array, attr, value) {
  for (var i = 0; i < array.length; i += 1) {
    if (array[i][attr] === value) {
      return i;
    }
  }
  return -1;
}