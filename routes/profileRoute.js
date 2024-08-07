const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const profiles = db.collection('users');
const posts = db.collection('posts');
const comments=db.collection('comments');
const applyList = db.collection('OTP')
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const {  HeadObjectCommand, PutObjectCommand,DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const multer = require('multer');
const {s3Client} = require('../config/awsConfig'); // Adjust the path as needed
//const storage = multer.memoryStorage();
const upload = multer();

// Middleware to parse JSON stringified data
const parseDataMiddleware = (req, res, next) => {
  if (req.body.data) {
    try {
      req.body.data = JSON.parse(req.body.data);
      next();
    } catch (err) {
      console.error('Invalid JSON format:', err);
      return res.status(400).json({ message: 'Invalid JSON format for data' });
    }
  } else {
    return res.status(400).json({ message: 'Post data is required' });
  }
};
router.get('/profile', (req, res) => {
    // Access user-specific data from the session
    const user = req.session.user;//console.log("profile session:",req.session.id,user);
    if(user!==undefined) {
      if(user.password!==undefined) {
        const { password, ...secureUser } = user;//if there is a password in the account then send the user data without the password
        res.status(200).json(secureUser);
      }else{
         res.status(200).json(user);
      }
    }else{
      res.status(400).json({message: "Invalid session"})
    }
  });
   // Number of followers per page

   router.get(
    '/api/profile/:id/followers',
    [
      check('id').isMongoId().withMessage('Invalid profile ID'),
      check('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const id = req.params.id;
      const perPage = 10;
      const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
      const skip = (page - 1) * perPage; // Calculate the number of documents to skip
  
      try {
        const objectId = new ObjectId(id);
        // Assuming 'profiles' is your Mongoose model or any database model
        const profileFound = await profiles.findOne({ _id: objectId });
  
        if (!profileFound) {
          return res.status(404).json({ message: 'Profile not found' });
        }
  
        const followerIds = profileFound.followers; // Assuming followers are stored as an array of profile IDs
        // Fetch profile info for each unique userId
        const userProfiles = await profiles
          .find({ _id: { $in: followerIds.map(userId => new ObjectId(userId)) } })
          .skip(skip)
          .limit(perPage)
          .toArray();
  
        // Manually select only the desired fields from each profile
        const followers = userProfiles.map(profile => ({
          name: profile.name,
          linkname: profile.linkname,
          picture: profile.picture,
          // Include any additional fields you want to retain here
        }));
  
        res.status(200).json(followers);
      } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  );
  
  
  router.get('/api/profile/:id/following',  [
    check('id').isMongoId().withMessage('Invalid profile ID'),
    check('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }// console.log('get following route working');
    const id = req.params.id;
    const perPage = 10;
    const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
    const skip = (page - 1) * perPage; // Calculate the number of documents to skip
  
    try {
      const objectId = new ObjectId(id);
      // Assuming 'profiles' is your Mongoose model or any database model
      const profileFound = await profiles.findOne({ _id: objectId });
  
      if (!profileFound) {
        return res.status(404).json({ message: "Profile not found" });
      }
  
      const followingIds = profileFound.following; // Assuming followers are stored as an array of profile IDs
      // Fetch profile info for each unique userId
      const userProfiles = await profiles.find({ 
        _id: { $in: followingIds.map(userId => new ObjectId(userId)) }
    })
    .skip(skip)
    .limit(perPage)
    .toArray();   
     // Manually select only the desired fields from each profile
     const following = userProfiles.map(profile => ({
                                  name: profile.name,
                                  linkname: profile.linkname,
                                  picture: profile.picture,
                                  // Include any additional fields you want to retain here
                                  }));    
                               
   // console.log(following);
    res.status(200).json(following);
     
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  router.get('/api/profile/:linkname', [
    check('linkname').notEmpty().withMessage('Linkname must be a non-empty string')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const linkname = req.params.linkname
  //  console.log(req.params,linkname);
    // Assuming 'profiles' is your Mongoose model or any database model
   const profileFound= await profiles.findOne({linkname:linkname});//console.log(profileFound);
   if(!profileFound){return res.status(404).send({message: 'Profile not found '})}
   if (profileFound.password!==undefined) {
    const { password, ...profileWithoutPassword } = profileFound;
    /*The above line uses object destructuring to create a new object named profileWithoutPassword.
     The password field is explicitly extracted, and the rest of the fields are collected into profileWithoutPassword. */
     res.status(200).json(profileWithoutPassword);
   }else{
     res.status(200).json(profileFound);
   }
  });
  router.get('/api/profileById/:userId', [
    check('userId').isMongoId().withMessage('Invalid user ID'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.params.userId
  //  console.log(req.params,linkname);
    // Assuming 'profiles' is your Mongoose model or any database model
    const objectId = new ObjectId(userId);
      // Assuming 'profiles' is your Mongoose model or any database model
      const profileFound = await profiles.findOne({ _id: objectId });
      
      if (!profileFound) {
        return res.status(404).json({ message: "Profile not found" });
      }
   if (profileFound.password!==undefined) {
    const { password, ...profileWithoutPassword } = profileFound;
    /*The above line uses object destructuring to create a new object named profileWithoutPassword.
     The password field is explicitly extracted, and the rest of the fields are collected into profileWithoutPassword. */
     res.status(200).json(profileWithoutPassword);
   }else{
     res.status(200).json(profileFound);
   }
  });
  router.put('/profile/:profileId/remove-following/:otherProfileId',[
    check('profileId').isMongoId().withMessage('Invalid profile ID'),
    check('otherProfileId').isMongoId().withMessage('Invalid other profile ID')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { profileId, otherProfileId } = req.params;//console.log(profileId);console.log(otherProfileId);
    const profileFound = { _id:new ObjectId(profileId) };
    const otherProfileFound = { _id:new ObjectId(otherProfileId)};
    const update1 = {
       $pull: { following:otherProfileId  }
      };
    const update2={
       $pull: { followers:profileId}
    };
    try{
      const result1 = await profiles.updateOne(profileFound, update1);console.log(result1);
      const result2 = await profiles.updateOne(otherProfileFound, update2);console.log(result2);
      if ((result1.modifiedCount === 0)&&(result2.modifiedCount === 0)){
      // const updatedProfile=await profiles.findOne(profileFound);
        return res.status(404).json({ message: 'User profile not found' });
       }else{
         
         const updatedProfile = await profiles.findOne({ _id: new ObjectId(profileId) });
            if (updatedProfile) {
               req.session.user = updatedProfile;
               req.session.save((err) => { // Ensure session is saved before sending response
                 if (err) {
                   console.error('Session save error:', err);
                   return res.status(500).json({ message: 'Failed to save session' });
                 }
                // console.log("Session updated updated following", req.session.user);
                return res.status(200).json({profileId:profileId,otherProfileId:otherProfileId,message:"You have unfollowed this profile"});
               });
             } else {
               res.status(404).json({ message: 'User profile not found' });
             }
       }
    }catch(error){
      res.status(500).json({ message: 'Internal server error' });
    }
   
   });
   router.put('/profile/:profileId/add-following/:otherProfileId', [
    check('profileId').isMongoId().withMessage('Invalid profile ID'),
    check('otherProfileId').isMongoId().withMessage('Invalid other profile ID')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { profileId, otherProfileId } = req.params;
    const update1 = {
        $addToSet: { following: otherProfileId } // $addToSet ensures uniqueness
    };
    const update2 = {
        $addToSet: { followers: profileId } // $addToSet ensures uniqueness
    };
    try{
      const result1 = await profiles.updateOne({ _id: new ObjectId(profileId) }, update1);
     // console.log(result1);
  
      const result2 = await profiles.updateOne({ _id: new ObjectId(otherProfileId) }, update2);
     // console.log(result2);
  
      if (result1.modifiedCount === 0 && result2.modifiedCount === 0) {
        return res.status(404).json({ message: 'User profile not found' });
      }else{
        const updatedProfile = await profiles.findOne({ _id: new ObjectId(profileId) });
            if (updatedProfile) {
               req.session.user = updatedProfile;
               req.session.save((err) => { // Ensure session is saved before sending response
                 if (err) {
                   console.error('Session save error:', err);
                   return res.status(500).json({ message: 'Failed to save session' });
                 }
                // console.log("Session updated updated following", req.session.user);
                 return res.status(200).json({profileId:profileId,otherProfileId:otherProfileId,message:"You have followed this profile"});
               });
             } else {
               res.status(404).json({ message: 'User profile not found' });
             }
      }
    }catch(error){
      res.status(500).json({message: 'Internal server error' });
    } 
   
});

router.post('/add-blocked-users/:profileId/:otherProfileId', [
  check('profileId').isMongoId().withMessage('Invalid profile ID'),
  check('otherProfileId').isMongoId().withMessage('Invalid other profile ID')
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
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
   
        req.session.user=profileFound;
        if(profileFound.password!==undefined){
          const {password,...secureProfile}=profileFound;
         return res.status(200).json({profile:secureProfile});
        }else{
          res.status(200).json({profile:profileFound});
        }
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
router.post('/remove-blocked-users/:profileId/:otherProfileId', [
  check('profileId').isMongoId().withMessage('Invalid profile ID'),
  check('otherProfileId').isMongoId().withMessage('Invalid other profile ID')
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { profileId, otherProfileId } = req.params;
  //console.log("after removing block:",profileId,otherProfileId);
  try{
    const update={
      $pull:{
        blockedUsers:otherProfileId
      }
    }
    const result= await profiles.updateOne({ _id:new ObjectId(profileId) }, update);//console.log("after removing block:",result);
    
   const updatedProfile=await profiles.findOne({ _id: new ObjectId(profileId) });
   if(result.modifiedCount ===0){
    return res.status(500).json({ message: 'Internal server error.' });
   }else{
    req.session.user=updatedProfile;
   return res.status(200).json({ message: 'Successfully unblocked.' });
   }
    
  }catch(err){
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  }

})

router.get('/api/ownComments/:profileId', [
  check('profileId').isMongoId().withMessage('Invalid profile ID'),
  check('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
],
async (req, res) => {
 // console.log("own comment link working");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { profileId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const perPage = 5;

  try {
    const commentsData = await comments.find({ userId:profileId })
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();
   
   //console.log(commentsData)
   // Collect unique userIds from the comments
   const postIds = [...new Set(commentsData.map(comment => comment.postId))];

   // Fetch profile info for each unique postId
   const userPosts = await posts.find({ _id: { $in: postIds.map(postId => new ObjectId(postId)) } }).toArray();

   // Convert the userPosts array to a map for quick lookup
   const postsMap = userPosts.reduce((map, post) => {
     map[post._id.toString()] = post; // Use toString() to ensure the _id object matches the postId string format
     return map;
   }, {});

   // Merge profile info into comments
   const enrichedComments = commentsData.map(comment => {
     const post = postsMap[comment.postId];
     return {
       ...comment,
       postTitle:post?post.title: undefined // Handle case where profile might not exist for a postId
     };
   });
  // console.log(enrichedComments)
    res.status(200).json(enrichedComments);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ error: 'Failed to fetch paginated data' });
  }
});

router.post('/api/editProfile/:profileId', upload.single('image'), parseDataMiddleware, [
  // Validate and sanitize fields
  check('profileId').isMongoId().withMessage('Invalid profile ID'),
  check('data').notEmpty().withMessage('Post data is required'),
  check('data.profileType').optional().notEmpty().withMessage('profileType is required'),
  check('data.name').notEmpty().isString().withMessage('name is required'),
  check('data.education').optional().notEmpty().withMessage('Content is required'),
  check('data.organization').optional().isString().withMessage('Organization must be a string'),
  check('data.location').optional().isString().withMessage('location must be a string'),
  check('data').custom((value, { req }) => {
    const editedData = value;
    if (!editedData.email || !/\S+@\S+\.\S+/.test(editedData.email)) throw new Error('Valid email is required');
    if (editedData.phone && !/^\d{10}$/.test(editedData.phone)) throw new Error('Valid phone number is required');
    if (editedData.password && !/(?=^.{8,}$)((?=.*\d)(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/.test(editedData.password)) throw new Error('Valid password number is required');
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(req.body);
    return res.status(400).json({ message: errors.array() });
  }
  const { profileId } = req.params;
  const editedData = req.body.data; // Adjust as needed based on your front-end data format
  const pwd = editedData.password;

  if (pwd.length > 0) {
    const hashedPassword = await bcrypt.hash(pwd, 10);
    editedData.password = hashedPassword;
  } else {
    delete editedData.password;
  }

  const file = req.file;
  if (file) {
    const fileName = file.originalname.concat(profileId);
    const bucketName = 'assamemployment';
    const s3Key = `profilePicture/${fileName}`; // Unique file name where the "profilePicture" is the folder name in S3 bucket

    const headParams = {
      Bucket: bucketName,
      Key: s3Key // Use unique file name
    };

    try {
      await s3Client.send(new HeadObjectCommand(headParams));
      // If the file exists, set the imageUrl to its location
      editedData.picture = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
    } catch (headErr) {
      if (headErr.name === 'NotFound') {
        const uploadParams = {
          Bucket: bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const upload = new Upload({
          client: s3Client,
          params: uploadParams,
        });

        try {
          const s3Data = await upload.done();
          editedData.picture = s3Data.Location;
        } catch (uploadErr) {
          console.error('S3 Upload Error:', uploadErr);
          return res.status(500).json({ message: 'Failed to upload the image' });
        }
      } else {
        console.error('S3 HeadObject Error:', headErr);
        return res.status(500).json({ message: 'Failed to check existing image' });
      }
    }
  }

  try {
    const objectId = new ObjectId(profileId);
    const profileFound = await profiles.findOne({ _id: objectId });

    if (profileFound.picture && file) {
      let previousFileKey = null;
      try {
        const url = new URL(profileFound.picture);
        previousFileKey = url.pathname.substring(1); // Remove the leading "/"
      } catch (urlParseError) {
        console.error('Failed to parse URL:', profileFound.picture);
        return res.status(500).json({ message: 'Failed to delete the previous profile picture: Invalid S3 URL' });
      }

      if (!previousFileKey) {
        console.error('Failed to extract the S3 key from the URL:', profileFound.picture);
        return res.status(500).json({ message: 'Failed to delete the previous profile picture: Invalid S3 URL' });
      }

      const deleteParams = {
        Bucket: 'assamemployment',
        Key: previousFileKey
      };

      try {
        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log('Previous profile picture deleted from S3:', previousFileKey);
      } catch (deleteErr) {
        console.error('Failed to delete the previous profile picture from S3:', deleteErr);
        return res.status(500).json({ message: 'Failed to delete the previous profile picture' });
      }
    }

    if (editedData.name) {
      const existingProfileWithSameName = await profiles.findOne({
        name: editedData.name,
        _id: { $ne: objectId }, // Exclude the current profile from the search
      });

      if (existingProfileWithSameName) {
        return res.status(400).json({ message: 'The username is already in use by another profile, please try a different username.' });
      }
    }

    const updatedProfile = { ...profileFound, ...editedData };

   // console.log('Profile Before Update:', profileFound);
   // console.log('Profile After Update:', updatedProfile);

    const result = await profiles.updateOne({ _id: objectId }, { $set: updatedProfile });
   // console.log(profileFound, result, editedData);

    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: 'Failed to update the profile' });
    }

    req.session.user = updatedProfile;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Failed to save session' });
      }
    });

    if (updatedProfile.password !== undefined) {
      const { password, ...profileWithoutPassword } = updatedProfile;
      res.status(200).json({ message: 'Profile updated successfully', profileWithoutPassword });
    } else {
      res.status(200).json({ message: 'Profile updated successfully', updatedProfile });
    }
  } catch (error) {
    console.error('Failed to edit the profile:', error);
    res.status(500).json({ message: 'Failed to edit the profile' });
  }
});


//get applyList from the OTP list
router.get('/api/applyList', [
  check('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const page = parseInt(req.query.page) || 1; // Current page number
  const perPage = 5; // Number of items per page
  
  try {
    // Query the applyList database excluding entries without isVerified: true
    let applyQuery = await applyList.find({ verified: true })
      .sort({ timestamp: -1 }) // Sort entries by descending timestamp
      .skip((page - 1) * perPage) // Skip entries for previous pages
      .limit(perPage) // Limit entries per page
      .toArray();

    // Enrich each entry with the corresponding post's title
    let enrichedQuery = await Promise.all(applyQuery.map(async (list) => {
      try {
        const id = new ObjectId(list.postId);
        const post = await posts.findOne({ _id: id });

        if (post) {
          return {
            ...list,
            postName: post.title // Add the post's title as 'postName'
          };
        } else {
          return {
            ...list,
            postName: "Unknown Post" // Handle case if post is not found
          };
        }
      } catch (error) {
        console.error('Failed to fetch post details:', error);
        return {
          ...list,
          postName: "Error fetching post details" // Handle case if there's an error in fetching
        };
      }
    }));

    res.status(200).json(enrichedQuery);
   // console.log("Getting queries with enriched data:", page, enrichedQuery);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// route for deleting apllyList
router.delete('/api/applyList/delete/:queryId',  [
  check('queryId').isMongoId().withMessage('Invalid query ID'),
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { queryId } = req.params;

  try {
    const deleteResult = await applyList.deleteOne({ _id: new ObjectId(queryId) });

    if (deleteResult.deletedCount === 0) {
      // No document found with the given ID, or it couldn't be deleted
      return res.status(404).json({ message: 'query not found or already deleted' });
    }

    // Successfully deleted the document
    res.status(200).json({ message: 'query deleted successfully' });
  } catch (error) {
    console.error('Error deleting query:', error);
    res.status(500).json({ message: 'Failed to delete query' });
  }
});
router.post('/api/resetPassword',[
  check('newPassword').notEmpty().withMessage('Password cannot be empty'),
  check('userId').isMongoId().withMessage('Invalid userId'),
], async (req, res) => {
  try {
    const { newPassword, userId } = req.body;
    const objectId = new ObjectId(userId);
    const hashedPassword= await bcrypt.hash(newPassword,10);
    const profile = await profiles.findOne({ _id: objectId });

    if (!profile) {
      return res.status(404).send({ message: 'User not found' });
    }

    const editOtpResult = await profiles.updateOne(
      { _id: objectId },
      { $set: { password: hashedPassword } }
    );

   // console.log('reset route working:', userId, profile, editOtpResult);

    if (editOtpResult.modifiedCount === 0) {
      return res.status(501).send({ message: 'Password could not be reset' });
    }

    return res.status(200).send({ message: 'Password has been reset successfully' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
});
module.exports = router;