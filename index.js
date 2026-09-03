require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure database connection for requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

const authRoutes = require('./routes/auth');
const donorsRoutes = require('./routes/donors');
const bloodRequestsRoutes = require('./routes/bloodRequests');
const requestContactRoutes = require('./routes/requestContact');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

app.use('/api/auth', authRoutes);
app.use('/api/donors', donorsRoutes);
app.use('/api/blood-requests', bloodRequestsRoutes);
app.use('/api/request-contacts', requestContactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

app.get('/', (req, res) => {
  res.send('BloodConnect – Blood Management System Server is Running');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
