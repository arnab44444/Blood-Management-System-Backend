const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, getDB } = require('./db');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
  res.send('BloodConnect – Blood Management System');
});

async function start() {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch(console.error);
