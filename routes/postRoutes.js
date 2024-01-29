const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const collection = db.collection('posts');
// ... other middleware and configurations ...

// API route for fetching paginated data
router.get('/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Current page number
  const limit = parseInt(req.query.limit) || 10; // Number of items per page
  try {
    // Query the database using Mongoose
    const data = await collection.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // Count the total number of documents in the collection
    const totalDocuments = await collection.countDocuments().exec();

    // Construct and send the paginated response
    const response = {
      data: data,
      currentPage: page,
      totalPages: Math.ceil(totalDocuments / limit),
      totalItems: totalDocuments,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch paginated data:', error);
    res.status(500).json({ error: 'Failed to fetch paginated data' });
  }
});
router.post('/api/addPost',async (req,res)=>{
    try{
        const incomingPost=req.body.data;console.log(incomingPost);
        collection.insertOne(incomingPost)
        res.status(200).json({message:"post added successfully"})
    }catch(error){
        console.error('Failed to insert the post:', error);
        res.status(500).json({ error: 'Failed to upload the post' });
    }
    
})
module.exports = router;