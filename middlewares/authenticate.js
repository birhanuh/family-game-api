import jwt from 'jsonwebtoken'
import config from '../config'

import User from '../models/User'

// next is a callback function that calls the next function in chain 
export default (req, res, next) => {
  const authorizationHeader = req.headers['authorization']
  let token

  if (authorizationHeader) {
    token = authorizationHeader.split(' ')[1]
  }

  if (token) {
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: 'Failed to authenticate' })
      } else {
        User.find({ id: decoded.id }).then(user => {
          if (!user) {
            res.status(404).json({ error: 'No such user' })
          } else {
            req.currentUser = user
            next()
          }
        })

        // We don't need to query db on each request. Later where we need user
        // we can query db and handle non existing user. Most of the time we need user id anyway e.g
        // to create relationship b/n tables...
        //  req.userId = decoded.id
        //  next()
      }
    })
  } else {
    res.status(403).json({
      error: 'No token provided'
    })
  }
}