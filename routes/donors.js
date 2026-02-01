const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { verifyJWT, requireRole } = require('../middleware/auth');

const router = express.Router();
const DONATION_COOLDOWN_DAYS = 90;

function canDonate(lastDonationDate) {
  if (!lastDonationDate) return true;
  const last = new Date(lastDonationDate);
  const now = new Date();
  const days = (now - last) / (1000 * 60 * 60 * 24);
  return days >= DONATION_COOLDOWN_DAYS;
}

function nextEligibleDate(lastDonationDate) {
  if (!lastDonationDate) return null;
  const last = new Date(lastDonationDate);
  const next = new Date(last);
  next.setDate(next.getDate() + DONATION_COOLDOWN_DAYS);
  return next;
}

// Create or update donor profile (donor only)
router.put('/profile', verifyJWT, requireRole('donor'), async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const {
      fullName,
      bloodGroup,
      age,
      gender,
      mobile,
      email,
      district,
      area,
      lastDonationDate,
      healthEligible,
      available,
      emergencyAvailable,
    } = req.body;
    if (age != null && (age < 18 || age > 100)) {
      return res.status(400).json({ message: 'Age must be 18 or above' });
    }
    const doc = {
      userId: new ObjectId(userId),
      fullName: fullName ?? undefined,
      bloodGroup: bloodGroup ?? undefined,
      age: age ?? undefined,
      gender: gender ?? undefined,
      mobile: mobile ?? undefined,
      email: email ?? undefined,
      district: district ?? undefined,
      area: area ?? undefined,
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : undefined,
      healthEligible: healthEligible ?? undefined,
      available: available ?? true,
      emergencyAvailable: emergencyAvailable ?? false,
      donationCount: 0,
      verified: false,
      updatedAt: new Date(),
    };
    const existing = await db.collection('donors').findOne({ userId: doc.userId });
    if (existing) {
      doc.donationCount = existing.donationCount ?? 0;
      doc.verified = existing.verified ?? false;
      doc.createdAt = existing.createdAt;
    } else {
      doc.createdAt = new Date();
    }
    const filter = { userId: doc.userId };
    const update = { $set: {} };
    Object.keys(doc).forEach((k) => {
      if (k !== 'userId' && doc[k] !== undefined) update.$set[k] = doc[k];
    });
    await db.collection('donors').updateOne(filter, update, { upsert: true });
    const donor = await db.collection('donors').findOne(filter);
    res.json({ donor, canDonate: canDonate(donor.lastDonationDate) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get my donor profile
router.get('/profile', verifyJWT, requireRole('donor'), async (req, res) => {
  try {
    const db = getDB();
    const donor = await db.collection('donors').findOne({ userId: new ObjectId(req.user.id) });
    if (!donor) return res.status(404).json({ message: 'Donor profile not found' });
    const canDonateNow = canDonate(donor.lastDonationDate);
    const safe = {
      ...donor,
      canDonate: canDonateNow,
      nextEligibleDate: canDonateNow ? null : nextEligibleDate(donor.lastDonationDate),
    };
    delete safe.mobile;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Donor: my upcoming bookings (accepted requests not yet completed)
router.get('/my-bookings', verifyJWT, requireRole('donor'), async (req, res) => {
  try {
    const db = getDB();
    const donorId = new ObjectId(req.user.id);
    const contacts = await db.collection('requestContacts').find({ donorId }).toArray();
    const requestIds = contacts.map((c) => c.requestId);
    if (requestIds.length === 0) return res.json([]);
    const requests = await db.collection('bloodRequests').find({ _id: { $in: requestIds }, status: { $ne: 'completed' } }).toArray();
    const withContact = requests.map((r) => ({
      requestId: r._id,
      patientName: r.patientName,
      contactNumber: r.contactNumber,
      bloodGroup: r.bloodGroup,
      bags: r.bags,
      hospitalName: r.hospitalName,
      location: r.location,
      requiredDate: r.requiredDate,
      requiredTime: r.requiredTime,
      emergencyLevel: r.emergencyLevel,
      status: r.status,
    }));
    res.json(withContact);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Donor: my donation history
router.get('/donation-history', verifyJWT, requireRole('donor'), async (req, res) => {
  try {
    const db = getDB();
    const donorId = req.user.id;
    const history = await db
      .collection('donationHistory')
      .find({ donorId: new ObjectId(donorId) })
      .sort({ completedAt: -1 })
      .limit(50)
      .toArray();
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search donors (patient / admin / ngo) – all available donors; filter by bloodGroup, district, availability
// Patient sees donor mobile only when they have an approved request contact with that donor
router.get('/search', verifyJWT, async (req, res) => {
  try {
    const db = getDB();
    const { bloodGroup, district, area, available, emergency } = req.query;
    const filter = {};
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (district) filter.district = new RegExp(district, 'i');
    if (area) filter.area = new RegExp(area, 'i');
    if (available !== undefined) filter.available = available === 'true';
    if (emergency === 'true') filter.emergencyAvailable = true;
    const donors = await db
      .collection('donors')
      .find(filter)
      .sort({ verified: -1, emergencyAvailable: -1, available: -1, lastDonationDate: 1 })
      .limit(100)
      .toArray();

    let donorIdsWithApprovedContact = new Set();
    if (req.user.role === 'patient') {
      const patientRequestIds = await db
        .collection('bloodRequests')
        .find({ patientId: new ObjectId(req.user.id) })
        .project({ _id: 1 })
        .toArray();
      const requestIds = patientRequestIds.map((r) => r._id);
      const approvedContacts = await db
        .collection('requestContacts')
        .find({ requestId: { $in: requestIds }, adminApproved: true })
        .project({ donorId: 1 })
        .toArray();
      donorIdsWithApprovedContact = new Set(approvedContacts.map((c) => c.donorId.toString()));
    }

    const withEligibility = donors.map((d) => {
      const showMobile = req.user.role === 'admin' ||
        (req.user.role === 'patient' && donorIdsWithApprovedContact.has(d.userId.toString()));
      const out = {
        ...d,
        canDonate: canDonate(d.lastDonationDate),
      };
      if (!showMobile) delete out.mobile;
      return out;
    });
    res.json(withEligibility);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: verify donor
router.patch('/:id/verify', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const db = getDB();
    await db
      .collection('donors')
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { verified: true, verifiedAt: new Date() } }
      );
    res.json({ message: 'Donor verified' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
