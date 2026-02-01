const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { verifyJWT, requireRole } = require('../middleware/auth');

const router = express.Router();
const COOLDOWN_DAYS = 90;

function canDonate(lastDonationDate) {
  if (!lastDonationDate) return true;
  const last = new Date(lastDonationDate);
  const now = new Date();
  const days = (now - last) / (1000 * 60 * 60 * 24);
  return days >= COOLDOWN_DAYS;
}

function nextEligibleDate(lastDonationDate) {
  if (!lastDonationDate) return null;
  const last = new Date(lastDonationDate);
  const next = new Date(last);
  next.setDate(next.getDate() + COOLDOWN_DAYS);
  return next;
}

// Donor accepts a request → create contact record (pending admin approval). Blocked if within 90-day cooldown.
router.post('/', verifyJWT, requireRole('donor'), async (req, res) => {
  try {
    const db = getDB();
    const donorId = req.user.id;
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ message: 'requestId required' });
    const bloodRequest = await db.collection('bloodRequests').findOne({ _id: new ObjectId(requestId) });
    if (!bloodRequest) return res.status(404).json({ message: 'Request not found' });
    const donor = await db.collection('donors').findOne({ userId: new ObjectId(donorId) });
    if (!donor) return res.status(400).json({ message: 'Donor profile required' });
    if (!canDonate(donor.lastDonationDate)) {
      const next = nextEligibleDate(donor.lastDonationDate);
      const dateStr = next ? next.toLocaleDateString() : '';
      return res.status(400).json({
        message: `You cannot accept new requests until 90 days after your last donation. Next eligible: ${dateStr}`,
        nextEligibleDate: next,
      });
    }
    const existing = await db.collection('requestContacts').findOne({
      requestId: new ObjectId(requestId),
      donorId: new ObjectId(donorId),
    });
    if (existing) return res.status(400).json({ message: 'Already responded' });
    const activeBookings = await db.collection('requestContacts').find({ donorId: new ObjectId(donorId) }).toArray();
    const requestIds = activeBookings.map((b) => b.requestId);
    const requests = requestIds.length ? await db.collection('bloodRequests').find({ _id: { $in: requestIds }, status: { $ne: 'completed' } }).toArray() : [];
    if (requests.length > 0) {
      return res.status(400).json({ message: 'You are already committed to a request. Complete or wait for it before accepting another.' });
    }
    const doc = {
      requestId: new ObjectId(requestId),
      donorId: new ObjectId(donorId),
      status: 'pending',
      adminApproved: false,
      contactUnlockedAt: null,
      createdAt: new Date(),
    };
    const result = await db.collection('requestContacts').insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: approve contact → unlock contact (donor phone visible to patient)
router.patch('/:id/approve', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    await db.collection('requestContacts').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { adminApproved: true, contactUnlockedAt: new Date(), updatedAt: new Date() } }
    );
    res.json({ message: 'Contact approved and unlocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get contacts for a request (admin or patient who owns request) – after approve, include donor mobile
router.get('/request/:requestId', verifyJWT, async (req, res) => {
  try {
    const db = getDB();
    const request = await db.collection('bloodRequests').findOne({
      _id: new ObjectId(req.params.requestId),
    });
    const bloodReq = await db.collection('bloodRequests').findOne({ _id: new ObjectId(req.params.requestId) });
    if (!bloodReq) return res.status(404).json({ message: 'Request not found' });
    if (req.user.role === 'patient' && bloodReq.patientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const contacts = await db
      .collection('requestContacts')
      .find({ requestId: new ObjectId(req.params.requestId) })
      .toArray();
    const donorUserIds = [...new Set(contacts.map((c) => c.donorId))];
    const donors = await db.collection('donors').find({ userId: { $in: donorUserIds } }).toArray();
    const donorMap = Object.fromEntries(donors.map((d) => [d.userId.toString(), d]));
    const withDonor = contacts.map((c) => {
      const d = donorMap[c.donorId.toString()];
      const showContact = req.user.role === 'admin' || c.adminApproved;
      return {
        ...c,
        donor: d
          ? {
              fullName: d.fullName,
              bloodGroup: d.bloodGroup,
              district: d.district,
              area: d.area,
              mobile: showContact ? d.mobile : undefined,
            }
          : null,
      };
    });
    res.json(withDonor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
