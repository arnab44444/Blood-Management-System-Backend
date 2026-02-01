const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { verifyJWT, requireRole } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/dashboard', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const [donorsTotal, donorsVerified, requestsTotal, requestsUrgent, contactsApproved] =
      await Promise.all([
        db.collection('donors').countDocuments(),
        db.collection('donors').countDocuments({ verified: true }),
        db.collection('bloodRequests').countDocuments(),
        db.collection('bloodRequests').countDocuments({ emergencyLevel: 'urgent' }),
        db.collection('requestContacts').countDocuments({ adminApproved: true }),
      ]);
    res.json({
      donorsTotal,
      donorsVerified,
      activeDonors: donorsVerified,
      requestsTotal,
      requestsUrgent,
      successfulContacts: contactsApproved,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List donors (admin) – all with verification status
router.get('/donors', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const donors = await db
      .collection('donors')
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    res.json(donors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Donation history (admin)
router.get('/donation-history', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const history = await db
      .collection('donationHistory')
      .find({})
      .sort({ completedAt: -1 })
      .limit(100)
      .toArray();
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Block user (set blocked flag in users)
router.patch('/users/:id/block', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { blocked: true, blockedAt: new Date() } }
    );
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
