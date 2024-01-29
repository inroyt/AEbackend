const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const profiles = db.collection('users');
const { ObjectId } = require('mongodb');
router.get('/api/profile', (req, res) => {
    // Access user-specific data from the session
    const users = req.session.user;
   
    console.log("profile session:",req.session.id,users);
    if (users) {
      res.send(users);
    } else {
      res.send('Please log in first.');
    }
  });
  router.get('/profile/:id', async (req, res) => {   // this route is used to send followers and followings data based on their id
    const id = req.params.id
    console.log(req.params,id);
    const objectId = new ObjectId(id);
    // Assuming 'profiles' is your Mongoose model or any database model
   const profileFound= await profiles.findOne({_id:objectId});console.log(profileFound);
   // Extract only the desired fields
   const { name, linkname, picture } = profileFound;

   // Create a new object with the selected fields
   const selectedFields = { name, linkname, picture };

   res.send(selectedFields);
  });
  router.get('/api/profile/:linkname', async (req, res) => {
    const linkname = req.params.linkname
    console.log(req.params,linkname);
    // Assuming 'profiles' is your Mongoose model or any database model
   const profileFound= await profiles.findOne({linkname:linkname});//console.log(profileFound);
   const { password, ...profileWithoutPassword } = profileFound;
   /*The above line uses object destructuring to create a new object named profileWithoutPassword.
    The password field is explicitly extracted, and the rest of the fields are collected into profileWithoutPassword. */
    res.send(profileWithoutPassword);
  });
  router.put('/profile/:profileId/remove-following/:otherProfileId',async (req,res) => {
    const { profileId, otherProfileId } = req.params;console.log(profileId);console.log(otherProfileId);
    const profileFound = { _id:new ObjectId(profileId) };
    const otherProfileFound = { _id:new ObjectId(otherProfileId)};
    const update1 = {
       $pull: { following:otherProfileId  }
      };
    const update2={
       $pull: { followers:profileId}
    };

   const result1 = await profiles.updateOne(profileFound, update1);console.log(result1);
   const result2 = await profiles.updateOne(otherProfileFound, update2);console.log(result2);
   if ((result1.modifiedCount === 1)&&(result2.modifiedCount === 1)){
   // const updatedProfile=await profiles.findOne(profileFound);
    res.send({profileId:profileId,otherProfileId:otherProfileId});
    }
   })
   router.put('/profile/:profileId/add-following/:otherProfileId', async (req, res) => {
    const { profileId, otherProfileId } = req.params;
    console.log(profileId);
    console.log(otherProfileId);

    // Check if otherProfileId is not already in the following array of profileId
    const profileToUpdate = await profiles.findOne({ _id: new ObjectId(profileId) });
    if (profileToUpdate.following.includes(otherProfileId)) {
        return res.status(400).send({ error: 'Already following this profile' });
    }

    // Check if profileId is not already in the followers array of otherProfileId
    const otherProfileToUpdate = await profiles.findOne({ _id: new ObjectId(otherProfileId) });
    if (otherProfileToUpdate.followers.includes(profileId)) {
        return res.status(400).send({ error: 'Already being followed by this profile' });
    }

    const update1 = {
        $addToSet: { following: otherProfileId } // $addToSet ensures uniqueness
    };
    const update2 = {
        $addToSet: { followers: profileId } // $addToSet ensures uniqueness
    };

    const result1 = await profiles.updateOne({ _id: new ObjectId(profileId) }, update1);
    console.log(result1);

    const result2 = await profiles.updateOne({ _id: new ObjectId(otherProfileId) }, update2);
    console.log(result2);

    if (result1.modifiedCount === 1 && result2.modifiedCount === 1) {
        res.send({ otherProfileId: otherProfileId, profileId: profileId });
    }
});

router.post('/add-blocked-users/:profileId/:otherProfileId', async (req, res) => {
  const {profileId,otherProfileId} = req.params;
  try {
    const updateOperation = {
      $addToSet: {
        blockedUsers: otherProfileId,
      },
    };
    
    const result = await profiles.updateOne(
      { _id:new ObjectId(profileId) },
      updateOperation
    );
    const update1 = {// Remove from both 'following' and 'followers' arrays in the user profile after blocking
      $pull: {
        following: otherProfileId,
        followers: otherProfileId 
      }
    };
    const result1 = await profiles.updateOne({ _id:new ObjectId(profileId) }, update1);

    const update2 ={
      $pull:{
        followers:profileId,
        following:profileId,
      }
    }
    const result2 = await profiles.updateOne({ _id:new ObjectId(otherProfileId) }, update2);console.log(result2);
    const profileFound= await profiles.findOne({_id:new ObjectId(profileId)});console.log("after blocking:",profileFound);

      res.status(200).send({profile:profileFound});
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
router.post('/remove-blocked-users/:profileId/:otherProfileId', async (req, res) => {
  const { profileId, otherProfileId } = req.params;console.log("user",profileId);console.log("unblocked user:",otherProfileId);
  try{
    const update={
      $pull:{
        blockedUsers:otherProfileId
      }
    }
    const result= await profiles.updateOne({ _id:new ObjectId(profileId) }, update);
   console.log("after removing block:",result);
  }catch(err){
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  }

})
module.exports = router;