const express = require('express')
const AWS = require('aws-sdk');
const shortid = require('shortid');
const jwt = require('jsonwebtoken');

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

// Get Users endpoint
router.get('/', function (req, res) {
  const params = {
    TableName: USERS_TABLE,
    Select: "ALL_ATTRIBUTES"
  }

  DynamoDB.scan(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get users' });
    }
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "Users not found" });
    }
  });
})

// Get User endpoint
router.get('/get/:userId', function (req, res) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  }

  DynamoDB.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get user' });
    }
    if (result.Item) {
      const { userId, username } = result.Item;

      res.json({ userId, username });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
})

// Create User endpoint
router.post('/create', function (req, res) {
  console.log(req.body);
  const { username } = req.body;

  if (typeof username !== 'string') {
    res.status(400).json({ error: '"username" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Item: {
      userId: shortid.generate(),
      username,
      games: [{ questions: [], players: [] }]
    },
  };

  DynamoDB.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create user' });
    }

    res.json({ userId: params.Item.userId, username });
  });
})


// Update User endpoint
router.put('/update/:userId', function (req, res) {
  const { username } = req.body;

  if (typeof username !== 'string') {
    res.status(400).json({ error: '"username" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
    UpdateExpression: 'SET username = :n',
    ExpressionAttributeValues: {
      ':n': username
    },
    // ReturnValues: "UPDATED_NEW"
  };

  DynamoDB.update(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not update user' });
    }

    res.json(result);
  });
})

// Create User endpoint
router.post('/delete/:userId', function (req, res) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  };

  DynamoDB.delete(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not delete user' });
    }

    if (result.Item) {
      const { username } = result.Item;
      res.json(`User ${username} is deleted!`);
    }
  });
})

// Get User endpoint
router.post('/sign-in', async function (req, res) {
  const { username } = req.body;

  if (typeof username !== 'string') {
    res.status(400).json({ error: '"username" must be a string' });
  }

  const result = await DynamoDB.scan({
    TableName: USERS_TABLE,
    Select: "ALL_ATTRIBUTES"
  }).promise();

  console.log('RS: ', result.Items)
  // find the index
  const indexToGet = findWithAttr(result.Items, 'username', username);
  if (indexToGet === -1) {
    // element not found
    res.status(400).json({ error: 'User not found' });
  } else {
    const { userId, username } = result.Items[indexToGet];

    const token = jwt.sign({
      userId,
      username
    }, process.env.jwtSecret)

    res.json({ userId, username, token });
  }
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