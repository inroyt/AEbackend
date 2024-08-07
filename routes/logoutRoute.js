const express = require('express');
const router = express.Router();

router.get('/logout', (req, res) => {//console.log('loggedout successfully');
    // Destroy the session to log the user out
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:',err);
      }
      res.status(200).json({message:'Logged out successfully!'});
    });
  });

  module.exports = router;