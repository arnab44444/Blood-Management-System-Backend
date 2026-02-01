/**
 * Creates an admin user so you can log in as admin.
 * Run once: node seed-admin.js
 *
 * Admin login:
 *   Email:    admin@bloodconnect.com
 *   Password: Admin@123
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, getDB } = require('./db');

const ADMIN_EMAIL = 'admin@bloodconnect.com';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_FULLNAME = 'Admin';
const ADMIN_MOBILE = '0000000000';
const SALT_ROUNDS = 10;

async function seedAdmin() {
  try {
    await connectDB();
    const db = getDB();

    const existing = await db.collection('users').findOne({ email: ADMIN_EMAIL });
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    if (existing) {
      await db.collection('users').updateOne(
        { email: ADMIN_EMAIL },
        { $set: { role: 'admin', password: hashed, fullName: ADMIN_FULLNAME, mobile: ADMIN_MOBILE } }
      );
      console.log('Admin user updated. You can log in with:');
    } else {
      await db.collection('users').insertOne({
        email: ADMIN_EMAIL,
        password: hashed,
        role: 'admin',
        fullName: ADMIN_FULLNAME,
        mobile: ADMIN_MOBILE,
        createdAt: new Date(),
      });
      console.log('Admin user created. You can log in with:');
    }

    console.log('');
    console.log('  Email:    ' + ADMIN_EMAIL);
    console.log('  Password: ' + ADMIN_PASSWORD);
    console.log('');
    console.log('Go to Login and use these credentials. Then open /admin for the admin panel.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
