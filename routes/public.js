const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

// Public stats for home page (no auth)
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    const [donorsCount, requestsCount, urgentCount] = await Promise.all([
      db.collection('donors').countDocuments(),
      db.collection('bloodRequests').countDocuments(),
      db.collection('bloodRequests').countDocuments({ emergencyLevel: 'urgent', status: 'pending' }),
    ]);
    res.json({ donorsCount, requestsCount, urgentCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
