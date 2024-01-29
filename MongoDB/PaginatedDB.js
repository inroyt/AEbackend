const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const collection = db.collection('posts');
// ... other middleware and configurations ...

// API route for fetching paginated data
app.get('/api/data', async (req, res) => {
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

// ... other routes and server configurations ...

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
