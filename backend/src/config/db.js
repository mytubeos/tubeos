// src/config/db.js
// MongoDB connection with retry logic and event handlers

const mongoose = require('mongoose');
const { config } = require('./env');

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mongoose.connect(config.mongodb.uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });

      return; // success — loop se bahar

    } catch (error) {
      console.error(`❌ MongoDB attempt ${i + 1}/${retries} failed:`, error.message);
      if (i === retries - 1) throw error; // last retry pe throw karo
      await new Promise((res) => setTimeout(res, 3000)); // 3s wait
    }
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
};

module.exports = { connectDB, disconnectDB };
