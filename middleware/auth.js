const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
    if (user?.blocked) return res.status(403).json({ message: 'Account blocked' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(403).json({ message: 'Forbidden' });
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: 'Insufficient role' });
  };
}

module.exports = { verifyJWT, requireRole };
