const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.vwcukbn.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db;

async function connectDB() {
  if (db) return db;
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  db = client.db('bloodconnect');
  console.log('Connected to MongoDB bloodconnect');
  return db;
}

function getDB() {
  if (!db) throw new Error('DB not connected');
  return db;
}

module.exports = { connectDB, getDB, client };
