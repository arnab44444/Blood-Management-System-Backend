const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
const ROLES = ['donor', 'patient', 'admin', 'ngo'];

// Register
router.post('/register', async (req, res) => {
  try {
    const db = getDB();
    const { email, password, role, fullName, mobile } = req.body;
    if (!email || !password || !role || !fullName || !mobile) {
      return res.status(400).json({ message: 'Email, password, role, fullName and mobile are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = {
      email,
      password: hashed,
      role,
      fullName,
      mobile,
      createdAt: new Date(),
    };
    const result = await db.collection('users').insertOne(user);
    const id = result.insertedId.toString();
    const token = jwt.sign(
      { id, email, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      token,
      user: { email, role, fullName, _id: result.insertedId },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Me (current user)
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
