const express = require('express');
const app = express();
const cors = require("cors");
const corsOptions = require('./config/corsOptions');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./config/dbConn');
require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3500;
const loginRoutes = require('./routes/loginRoutes');
const logoutRoute = require('./routes/logoutRoute');
const postRoutes = require('./routes/postRoutes');
const profileRoute = require('./routes/profileRoute');
const login2Routes = require('./apiRoutes');
const testRoute = require('./routes/testRoute');
const messageRoute = require('./routes/messageRoute');
const qs = require('qs');
const websocketRoute = require('./routes/websocket');
const expressWs = require('express-ws')(app);


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); // Replace with your client's origin
  res.header('Access-Control-Allow-Credentials', true); //string if cors is added i.e. 'true'
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});
app.use(express.json());



// Sample data
  const items=require('./model/items.json');
  const users=require('./model/users.json');

// Paginated API endpoint

connectDB();

//app.use('/',testRoute);

app.get('/api/items', (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page

  // Calculate the starting index and ending index based on the page and limit
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  // Get the subset of items for the requested page
  const paginatedItems = items.slice(startIndex, endIndex);

  // Construct the response object with the paginated items and metadata
  const response = {
    items: paginatedItems,
    currentPage: page,
    totalPages: Math.ceil(items.length / limit),
  };

  res.json(response);
});
const sessionStore=MongoStore.create({
  mongoUrl: process.env.DATABASE_URI,
  ttl: 60 * 60, // Session TTL (in seconds)
})
app.use(
  session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Adjust this based on your deployment environment DO NOT FORGET THIS
      maxAge: 3600000, // Session duration in milliseconds (e.g., 1 hour)
    },
    store:sessionStore,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true, parameterLimit: 10000, limit: '10kb', qs: qs.parse }));

//app.use(saveUserToSession);
app.use('/', loginRoutes);
app.use('/', logoutRoute);
app.use('/',postRoutes);
app.use('/',login2Routes);
app.use('/',profileRoute);
app.use('/',messageRoute);
app.use('/', websocketRoute);

// Start the server
mongoose.connection.once('open', ()=>{
  console.log("Connected to MongoDB");
  app.listen(port,()=>{console.log(`Server running on port ${port}`)}); //we don't want to listen to requensts if mongoDB is not connected
})



/*
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const sessionStore = MongoStore.create({
  mongoUrl: process.env.DATABASE_URI,
  ttl: 60 * 60, // Session TTL (in seconds)
});

app.use(
  session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Adjust this based on your deployment environment
      maxAge: 3600000, // Session duration in milliseconds (e.g., 1 hour)
    },
    store: sessionStore, //
  })
);
 

 // res.send("Hello check");
     sessionToken = jwt.sign(
      {id:preciseUserData.id, email:preciseUserData.email, name:preciseUserData.name },
      process.env.ACCESS_TOKEN_SECRET, // Replace with your own secret key for signing the token
      { expiresIn: '1h' });

const items = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 4, name: 'Item 4' },
  { id: 5, name: 'Item 5' },
  { id: 6, name: 'Item 6' },
  { id: 7, name: 'Item 7' },
  { id: 8, name: 'Item 8' },
  { id: 9, name: 'Item 9' },
  { id: 10, name: 'Item 10' },
  { id: 11, name: 'Item 11' },
  { id: 12, name: 'Item 12' },
  { id: 13, name: 'Item 13' },
  { id: 14, name: 'Item 14' },
  { id: 15, name: 'Item 15' },
  { id: 16, name: 'Item 16' },
  { id: 17, name: 'Item 17' },
  { id: 18, name: 'Item 18' },
  { id: 19, name: 'Item 19' },
  { id: 20, name: 'Item 20' },
  { id: 21, name: 'Item 21' },
  { id: 22, name: 'Item 22' },
  { id: 23, name: 'Item 23' },
  { id: 24, name: 'Item 24' },
  { id: 25, name: 'Item 25' },
  { id: 26, name: 'Item 26' },
  { id: 27, name: 'Item 27' },
  { id: 28, name: 'Item 28' },
  { id: 29, name: 'Item 29' },
  { id: 30, name: 'Item 30' },
  // ... add more items
];
*/