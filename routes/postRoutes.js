const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const posts = db.collection('posts');
const profiles = db.collection('users');
const comments = db.collection('comments');
const { HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const multer = require('multer');
const { s3Client } = require('../config/awsConfig');
const upload = multer();

// Custom date format validation function
const isValidDateFormat = (value) => {
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  return regex.test(value);
};
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
router.get('/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Current page number
  const perPage = 5; // Number of items per page
  
  try {
    let postsData = await posts.find({ isSocial: { $ne: true } })
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();
    
    const enrichedPosts = await Promise.all(postsData.map(async (post) => {
      const commentsCount = await comments.countDocuments({ postId: post._id.toString() });
      return { ...post, comments: commentsCount };
    }));
    
    res.status(200).json(enrichedPosts);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ message: 'Failed to fetch paginated data' });
  }
});

router.get('/api/socialPosts', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Current page number
  const perPage = 5; // Number of items per page
  
  try {
    let postsData = await posts.find({ isSocial: true })
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();
    
    const enrichedPosts = await Promise.all(postsData.map(async (post) => {
      const commentsCount = await comments.countDocuments({ postId: post._id.toString() });
      return { ...post, comments: commentsCount };
    }));
    
    res.status(200).json(enrichedPosts);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ message: 'Failed to fetch paginated data' });
  }
});

router.get('/api/post/:postId', [
  check('postId').isMongoId().withMessage('Invalid postId format')
], async (req, res) => {
  const { postId } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const postFound = await posts.findOne({ _id: new ObjectId(postId) });
    if (postFound) {
      const commentsCount = await comments.countDocuments({ postId: postId });
      const postWithCommentCount = { ...postFound, comments: commentsCount };
      res.status(200).json(postWithCommentCount);
    } else {
      res.status(404).json({ message: 'Post Not Found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch the post' });
  }
});

//Route for adding a post
router.post('/api/addPost',upload.single('image'),parseDataMiddleware, [
  // Validate and sanitize fields
  check('data').notEmpty().withMessage('Post data is required'),
  check('data.postedById').notEmpty().withMessage('PostedById is required'),
  check('data.postedByName').notEmpty().withMessage('PostedByName is required'),
  check('data.title').notEmpty().withMessage('Title is required'),
  check('data.title').isLength({ max: 100 }).withMessage('Title should not exceed 100 characters'),
  check('data.details').notEmpty().withMessage('Content is required'),
  check('data.details').isLength({ max: 5000 }).withMessage('Content should not exceed 5000 characters'),
  check('data.organization').optional().isString().withMessage('Organization must be a string'),
  check('data.date').optional().custom(isValidDateFormat).withMessage('Date must be in dd-mm-yyyy format'),
  check('data.qualification').optional().isString().withMessage('Qualification must be a string'),
  check('data.vacancy').optional().isInt({ gt: 0 }).withMessage('Vacancy must be a positive integer'),
  check('data.category').optional().isString().withMessage('Category must be a string'),
  check('data.timestamp').isInt({ gt: 0 }).withMessage('Timestamp must be a positive integer')
],  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {//console.log(req.body)
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const incomingPost = req.body.data;
    const file = req.file;

    if (file) {
      const fileName = file.originalname;
      const bucketName = 'assamemployment';
      const s3Key = `posts/${fileName}`;

      const headParams = {
        Bucket: bucketName,
        Key: s3Key
      };

      try {
        await s3Client.send(new HeadObjectCommand(headParams));
        incomingPost.imageUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
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

          const s3Data = await upload.done();
          incomingPost.imageUrl = s3Data.Location;
        } else {
          throw headErr;
        }
      }
    }

    await posts.insertOne(incomingPost);
    res.status(200).json({ message: "Post added successfully" });
  } catch (error) {
    console.error('Failed to insert the post:', error);
    res.status(500).json({ message: 'Failed to upload the post' });
  }
});

router.put('/api/editPost/:postId', upload.single('image'),parseDataMiddleware, [
  // Validate and sanitize fields
  check('data').notEmpty().withMessage('Post data is required'),
  check('postId').isMongoId().withMessage('Invalid postId format'),
  check('data.postedById').notEmpty().withMessage('PostedById is required'),
  check('data.postedByName').notEmpty().withMessage('PostedByName is required'),
  check('data.title').notEmpty().withMessage('Title is required'),
  check('data.title').isLength({ max: 100 }).withMessage('Title should not exceed 100 characters'),
  check('data.details').optional().notEmpty().withMessage('Content is required'),
  //check('data.details').optional().isLength({ max: 5000 }).withMessage('Content should not exceed 5000 characters'),
  check('data.organization').optional().isString().withMessage('Organization must be a string'),
  check('data.date').optional().custom(isValidDateFormat).withMessage('Date must be in dd-mm-yyyy format'),
  check('data.qualification').optional().isString().withMessage('Qualification must be a string'),
  check('data.vacancy').optional().isInt({ gt: 0 }).withMessage('Vacancy must be a positive integer'),
  check('data.category').optional().isString().withMessage('Category must be a string'),
  check('link').optional().isURL().withMessage('Link must be a valid URL'),
  check('imageUrl').optional().isURL().withMessage('Image URL must be a valid URL'),
  check('isSocial').optional().isBoolean().withMessage('IsSocial must be a boolean'),
  check('data.timestamp').isInt({ gt: 0 }).withMessage('Timestamp must be a positive integer')
],  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {console.log(req.body)
    return res.status(400).json({ message: errors.array() });
  }
  try {
    const incomingPost = req.body.data; //before it was JSON.parse(req.body.data), but since the data is parsed in the middleware we do not parse it again;
    const file = req.file;
    const { postId } = req.params;

    if (file) {
      const fileName = file.originalname;
      const bucketName = 'assamemployment';
      const s3Key = `posts/${fileName}`;

      const headParams = {
        Bucket: bucketName,
        Key: s3Key
      };

      try {
        await s3Client.send(new HeadObjectCommand(headParams));
        incomingPost.imageUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
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

          const s3Data = await upload.done();
          incomingPost.imageUrl = s3Data.Location;
        } else {
          throw headErr;
        }
      }
    }

    if (!incomingPost) {
      return res.status(400).json({ message: 'New text content is required' });
    }

    const editPostResults = await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $set: incomingPost }
    );

    if (editPostResults.matchedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (editPostResults.modifiedCount === 0) {
      return res.status(304).json({ message: 'Post was not updated' });
    }

    res.status(200).json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Failed to update post' });
  }
});


router.delete('/api/deletePost/:postId', [
  check('postId').isMongoId().withMessage('Invalid postId format')
], async (req, res) => {
  const { postId } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const commentsDeleteResult = await comments.deleteMany({ postId: postId.toString() }, { session });
    const deleteResult = await posts.deleteOne({ _id: new ObjectId(postId) }, { session });

    if (deleteResult.deletedCount === 0 && commentsDeleteResult.deletedCount===0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Post not found or already deleted' });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Post and associated comments deleted successfully' });
  } catch (error) {
    console.error('Error deleting post and comments:', error);
    res.status(500).json({ message: 'Failed to delete post and comments' });
  }
});


router.post('/api/incrementLikes/:profileId/:postId', 
  [
    check('profileId').isMongoId().withMessage('Invalid profileId format'),
    check('postId').isMongoId().withMessage('Invalid postId format')
  ], async (req, res) => {
    // console.log('decrement route working',req.params);
    const { profileId, postId } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }
   try {
     // Increment the likes count for the specified post
     const result1 = await posts.updateOne(
       { _id: new ObjectId(postId) },
       { $inc: { likes: 1 } }  //even if there is no 'likes' property initially present in the post document within the MongoDB collection
     );                        //it will add "likes" property and then increment its value
 
     // Add the liked post id to the user's profile
     const result2 = await profiles.updateOne(
       { _id: new ObjectId(profileId) }, 
       { $addToSet: { likedPosts: postId } }
     );
 
     // Check if any documents were modified
     if (result1.modifiedCount === 0 || result2.modifiedCount === 0) { //console.log(result1,result2);
       return res.status(404).json({ message: 'Post not found or no change made' });
     }
     
  // Update session with the latest user profile data
 const updatedProfile = await profiles.findOne({ _id: new ObjectId(profileId) });
 if (updatedProfile) {
  
 req.session.user = updatedProfile;
   req.session.save((err) => { // Ensure session is saved before sending response
     if (err) {
       console.error('Session save error:', err);
       return res.status(500).json({message: 'Failed to save session' });
     }
    
     res.status(200).json({ message: 'Likes incremented successfully' });
   });
 } else {
  return res.status(404).json({message: 'User profile not found' });
 }
 
   } catch (error) {
     console.error('Failed to increment likes:', error);
     res.status(500).json({ message: 'Internal server error, Failed to like the post' });
   }
 });

router.post('/api/decrementLikes/:profileId/:postId', [
  check('profileId').isMongoId().withMessage('Invalid profileId format'),
  check('postId').isMongoId().withMessage('Invalid postId format')
], async (req, res) => {
  // console.log('decrement route working',req.params);
  const { profileId, postId } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }
   try {
     // Decrement the likes count for the specified post
     const result1 = await posts.updateOne(
       { _id: new ObjectId(postId) },
       { $inc: { likes: -1 } }
     );
 
     // Remove the liked post id from the user's profile
     const result2 = await profiles.updateOne(
       { _id: new ObjectId(profileId) }, 
       { $pull: { likedPosts: postId } }
     );
 
     // Check if any documents were modified
     if (result1.modifiedCount === 0 || result2.modifiedCount === 0) { //console.log(result1,result2);
       return res.status(404).json({ error: 'Post not found or no change made' });
     }
     
     // Update session with the latest user profile data
 const updatedProfile = await profiles.findOne({ _id: new ObjectId(profileId) });
 if (updatedProfile) {
  
   req.session.user = updatedProfile;
  
   req.session.save((err) => { // Ensure session is saved before sending response
     if (err) {
       console.error('Session save error:', err);
       return res.status(500).json({ message: 'Failed to save session' });
     }
    
     res.status(200).json({ message: 'Likes decremented successfully' });
   });
 } else {
  return res.status(404).json({ message: 'User profile not found' });
 }
 
   } catch (error) {
     console.error('Failed to decrement likes:', error);
     res.status(500).json({ message: 'Failed to decrement likes' });
   }
 });

 router.get('/api/getComments/:postId',
  [
    check('postId').isMongoId().withMessage('Invalid post ID format'),
    check('page').optional().isInt({ gt: 0 }).withMessage('Page must be a positive integer')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const perPage = 5;

  try {
    const commentsData = await comments.find({ postId })
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();

    // Collect unique userIds from the comments
    const userIds = [...new Set(commentsData.map(comment => comment.userId))];

    // Fetch profile info for each unique userId
    const userProfiles = await profiles.find({ _id: { $in: userIds.map(userId => new ObjectId(userId)) } }).toArray();

    // Convert the userProfiles array to a map for quick lookup
    const profilesMap = userProfiles.reduce((map, profile) => {
      map[profile._id.toString()] = profile; // Use toString() to ensure the _id object matches the userId string format
      return map;
    }, {});

    // Merge profile info into comments
    const enrichedComments = commentsData.map(comment => {
      const profile = profilesMap[comment.userId];
      return {
        ...comment,
        user: profile ? {
          name: profile.name,
          linkname: profile.linkname,
          picture: profile.picture
        } : undefined // Handle case where profile might not exist for a userId
      };
    });

    res.status(200).json(enrichedComments);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ message: 'Failed to fetch paginated data' });
  }
});
//Route for addding comments
router.post('/api/addComment', [
  check('text').notEmpty().withMessage('Text content is required'),
  check('userId').isMongoId().withMessage('Invalid userId format'),
  check('postId').isMongoId().withMessage('Invalid postId format'),
  check('timestamp').isInt({ gt: 0 }).withMessage('Timestamp must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const incomingComment = req.body;
    await comments.insertOne(incomingComment);
    res.status(200).json({ message: "Comment added successfully" });
  } catch (error) {
    console.error('Failed to insert the comment:', error);
    res.status(500).json({ message: 'Failed to upload the comment' });
  }
});

//route for editing comments
router.post('/api/post/comment/edit/:commentId',
  [
    check('commentId')
      .isMongoId().withMessage('Invalid comment ID format'),
    check('newText')
      .notEmpty().withMessage('New text content is required')
      .isString().withMessage('New text must be a string')
      .trim().isLength({ min: 1 }).withMessage('New text must not be empty')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }
  const { commentId } = req.params;
  const { newText } = req.body; 

  if (!newText) {
    return res.status(400).json({ message: 'New text content is required' });
  }

  try {
    const editCommentResult = await comments.updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { text: newText } }
    );

    if (editCommentResult.matchedCount === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (editCommentResult.modifiedCount === 0) {
      return res.status(304).json({ message: 'Comment was not updated' });
    }

    res.status(200).json({ message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Failed to update comment' });
  }
});

//Route for deleting comments
router.delete('/api/post/comment/delete/:commentId', [
  check('commentId').isMongoId().withMessage('Invalid commentId format')
], async (req, res) => { 
  const { commentId } = req.params;//console.log("dlelete comment route working",commentId)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const result = await comments.deleteOne({ _id: new ObjectId(commentId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

//add a savedPost
router.post('/addSavedPost/:profileId/add/:postId',
  [
    check('profileId')
      .isMongoId().withMessage('Invalid profile ID format'),
    check('postId')
      .isMongoId().withMessage('Invalid post ID format')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }
  const { profileId,postId } = req.params;
  const update = {$addToSet: { savedPosts: postId }} // $addToSet ensures uniqueness
  try{
   const result = await profiles.updateOne({ _id: new ObjectId(profileId) }, update);
   if (result.modifiedCount === 0 ) {
    return res.status(404).json({ error: 'Post not found' });
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
              res.status(200).json({message:"Successfully saved the post"});
            });
          } else {
           return res.status(404).json({ message: 'User profile not found' });
          }
   }
 }catch(error){
   res.status(500).json({ message: 'Internal server error' });
 } 
 
});

//Remove a savedPost
router.post('/removeSavedPost/:profileId/remove/:postId',[
  check('profileId')
    .isMongoId().withMessage('Invalid profile ID format'),
  check('postId')
    .isMongoId().withMessage('Invalid post ID format')
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }
 const { profileId,postId } = req.params; //console.log("remove saved post  route:",profileId,postId);
 const update = {$pull: { savedPosts:postId }} // remove the saved post Id
 try{
  const result = await profiles.updateOne({ _id: new ObjectId(profileId) }, update);//console.log(result);
  if (result.modifiedCount === 0 ) {
    return res.status(500).json({ message: 'Internal server error.' });
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
             res.status(200).json({message:"Successfully removed the post"});
           });
         } else {
          return res.status(404).json({ message: 'User profile not found' });
         }
  }
}catch(error){
  res.status(500).json({ message: 'Internal server error' });
} 

});
//Send the saved posts to the profile component in frontend
router.get('/api/savedPosts/:profileId',[
  check('profileId').isMongoId().withMessage('Invalid profile ID format'),
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }
 const {profileId}=req.params;
 const perPage = 5;
 const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
 const skip = (page - 1) * perPage; // Calculate the number of documents to skip
 try {
   const objectId = new ObjectId(profileId);
   
   const profileFound = await profiles.findOne({ _id: objectId });

   if (!profileFound) {
     return res.status(404).json({ error: "Profile not found" });
   }

   const savedPostIds = profileFound.savedPosts;
   // Fetch profile info for each unique PostId
   const savedPosts = await posts.find({ 
     _id: { $in: savedPostIds.map(userId => new ObjectId(userId)) }
 })
 .skip(skip)
 .limit(perPage)
 .toArray();   

    // Enrich posts data with the number of comments for each post
    const enrichedPosts = await Promise.all(savedPosts.map(async (post) => {
     // Correctly use post._id to find related comments
     const commentsCount = await comments.countDocuments({ postId: post._id.toString() });
     return { ...post, comments: commentsCount };
   }));
   const x=enrichedPosts.reverse();
   res.status(200).json(x);
  
 } catch (error) {
   console.error("Error fetching following:", error);
   res.status(500).json({ message: "Internal Server Error" });
 }
});
//Send the own posts to the profile component in frontend
router.get('/api/ownPosts/:profileId',[
  check('profileId').isMongoId().withMessage('Invalid profile ID format'),
],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }
 const {profileId}=req.params;
 const perPage = 5;
 const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
 const skip = (page - 1) * perPage; // Calculate the number of documents to skip
 try {
   const objectId = new ObjectId(profileId);
   
   const profileFound = await profiles.findOne({ _id: objectId });
   const linkname = profileFound.linkname;
   if (!profileFound) {
     return res.status(404).json({ message: "Profile not found" });
   }

   
   // Fetch profile info for each unique PostId
   const OwnPosts = await posts.find({ 
     postedById: linkname
 })
 .sort({ timestamp: -1 }) // sort by descending timestamp
 .skip(skip)
 .limit(perPage)
 .toArray();
  
 // console.log(page,OwnPosts);
    // Enrich posts data with the number of comments for each post
    const enrichedPosts = await Promise.all(OwnPosts.map(async (post) => {
     // Correctly use post._id to find related comments
     const commentsCount = await comments.countDocuments({ postId: post._id.toString() });
     return { ...post, comments: commentsCount };
   }));
   
   res.status(200).json(enrichedPosts);
  
 } catch (error) {
   console.error("Error fetching following:", error);
   res.status(500).json({ message: "Internal Server Error" });
 }
})
module.exports = router;
