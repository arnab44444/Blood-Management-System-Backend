const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { verifyJWT, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create blood request (patient)
router.post('/', verifyJWT, requireRole('patient'), async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const {
      patientName,
      bloodGroup,
      bags,
      hospitalName,
      location,
      requiredDate,
      requiredTime,
      emergencyLevel,
      contactNumber,
    } = req.body;
    if (!patientName || !bloodGroup || !hospitalName || !location || !contactNumber) {
      return res.status(400).json({ message: 'patientName, bloodGroup, hospitalName, location, contactNumber required' });
    }
    const doc = {
      patientId: new ObjectId(userId),
      patientName,
      bloodGroup,
      bags: Number(bags) || 1,
      hospitalName,
      location,
      requiredDate: requiredDate ? new Date(requiredDate) : new Date(),
      requiredTime: requiredTime || '',
      emergencyLevel: emergencyLevel || 'normal',
      contactNumber,
      status: 'pending',
      createdAt: new Date(),
    };
    const result = await db.collection('bloodRequests').insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List requests (patient: own; admin: all; emergency first)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const db = getDB();
    const { emergency, status, bloodGroup } = req.query;
    const filter = {};
    if (req.user.role === 'patient') filter.patientId = new ObjectId(req.user.id);
    if (emergency === 'true') filter.emergencyLevel = 'urgent';
    if (status) filter.status = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    const requests = await db
      .collection('bloodRequests')
      .find(filter)
      .sort({ emergencyLevel: -1, createdAt: -1 })
      .limit(100)
      .toArray();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one request
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const db = getDB();
    const r = await db.collection('bloodRequests').findOne({ _id: new ObjectId(req.params.id) });
    if (!r) return res.status(404).json({ message: 'Request not found' });
    if (req.user.role === 'patient' && r.patientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: approve or reject request (approving also unlocks all donor contacts for that request)
router.patch('/:id/status', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const requestId = new ObjectId(req.params.id);
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }
    await db
      .collection('bloodRequests')
      .updateOne(
        { _id: requestId },
        { $set: { status, updatedAt: new Date() } }
      );
    if (status === 'approved') {
      await db.collection('requestContacts').updateMany(
        { requestId },
        { $set: { adminApproved: true, contactUnlockedAt: new Date(), updatedAt: new Date() } }
      );
    }
    res.json({ message: `Request ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: unlock all donor contacts for this request (e.g. for requests approved before auto-unlock)
router.patch('/:id/unlock-contacts', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const requestId = new ObjectId(req.params.id);
    const request = await db.collection('bloodRequests').findOne({ _id: requestId });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    const result = await db.collection('requestContacts').updateMany(
      { requestId },
      { $set: { adminApproved: true, contactUnlockedAt: new Date(), updatedAt: new Date() } }
    );
    res.json({ message: 'Donor contacts unlocked', count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: mark donation completed (records donation history, increments donor count, sets cooldown)
router.patch('/:id/complete', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    const requestId = new ObjectId(req.params.id);
    const { donorId } = req.body;
    if (!donorId) return res.status(400).json({ message: 'donorId (user id) required' });
    const request = await db.collection('bloodRequests').findOne({ _id: requestId });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    const donor = await db.collection('donors').findOne({ userId: new ObjectId(donorId) });
    if (!donor) return res.status(400).json({ message: 'Donor not found' });
    const now = new Date();
    await db.collection('donationHistory').insertOne({
      requestId,
      donorId: new ObjectId(donorId),
      patientId: request.patientId,
      patientName: request.patientName,
      donorName: donor.fullName,
      bloodGroup: request.bloodGroup,
      hospitalName: request.hospitalName,
      completedAt: now,
      createdAt: now,
    });
    await db.collection('donors').updateOne(
      { userId: new ObjectId(donorId) },
      { $set: { lastDonationDate: now, donationCount: (donor.donationCount || 0) + 1, updatedAt: now } }
    );
    await db.collection('bloodRequests').updateOne(
      { _id: requestId },
      { $set: { status: 'completed', updatedAt: now } }
    );
    res.json({ message: 'Donation marked completed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
