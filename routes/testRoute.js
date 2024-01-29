const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const profiles = db.collection('users');
const { ObjectId } = require('mongodb');
router.get('api/profile/:follower', async (req, res) => {
    const follower = req.params.follower
    console.log(req.params,follower);
    
    // Assuming 'profiles' is your Mongoose model or any database model
   const followerFound= await profiles.findOne({name:follower});console.log(followerFound);
   res.send(followerFound)
  });
  router.get('/profile/:id', async (req, res) => {
    const id = req.params.id
    console.log(req.params,id);
    const objectId = new ObjectId(id);
    // Assuming 'profiles' is your Mongoose model or any database model
   const followerFound= await profiles.findOne({_id:objectId});console.log(followerFound);
   res.send(followerFound)
  });

  module.exports = router;