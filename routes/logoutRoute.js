const express = require('express');
const router = express.Router();

router.get('/api/logout', (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:',err);
      }
      res.send('Logged out successfully!');
    });
  });

  module.exports = router;