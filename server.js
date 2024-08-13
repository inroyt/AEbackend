const express = require('express');
const app = express();
const cors = require("cors");
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./config/dbConn');
require('dotenv').config();
const fs = require('fs');
const https = require('https');
// Port for HTTPS
const PORT = process.env.PORT;

// Routes
const loginRoutes = require('./routes/loginRoutes');
const logoutRoute = require('./routes/logoutRoute');
const postRoutes = require('./routes/postRoutes');
const profileRoute = require('./routes/profileRoute');
const messageRoute = require('./routes/messageRoute');
const websocketRoute = require('./routes/websocket');
const expressWs = require('express-ws')(app);//although this isn't used anywhere in this component but it is necessary for websocket initialization
const searchRoute = require('./routes/searchRoute');
const otpRoute= require('./routes/otpRoutes');
// Connect to Database
connectDB();

// CORS Configuration (Consider using corsOptions if necessary)

//http://localhost:3000','http://192.168.0.177:3000','http://192.168.29.88:3000',

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['https://www.assamemployment.org','https://assamemployment.org'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true // to support sending cookies with CORS requests
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware setup
app.use(session({
  secret: process.env.ACCESS_TOKEN_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Set to true in production with HTTPS
    sameSite:'none', // Use 'none' for cross-site cookies with HTTPS, 'lax' or 'strict' otherwise
    maxAge: 86400000, // 24 hours
    domain: '.assamemployment.org', // Adjust as needed
  },
  store: MongoStore.create({
    mongoUrl: process.env.DATABASE_URI,
    ttl: 60 * 60 * 24, // 24 hours
  }),
}));


// Routes
app.use('/', loginRoutes);
app.use('/', logoutRoute);
app.use('/', postRoutes);
app.use('/', profileRoute);
app.use('/', messageRoute);
app.use('/', websocketRoute);
app.use('/', searchRoute);
app.use('/', otpRoute);
// Read the SSL certificate and key

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  app.listen(PORT,() => {
    console.log(`Server running on https://assamemployment.org`);
  });
});
