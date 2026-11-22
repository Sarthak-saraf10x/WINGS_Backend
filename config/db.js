const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const localUri = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/wing_tours_travels';

  if (primaryUri) {
    try {
      const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 2500 });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (primaryErr) {
      console.warn(`Primary MongoDB connection failed: ${primaryErr.message}. Trying local MongoDB...`);
    }
  }

  try {
    const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2500 });
    console.log(`MongoDB Connected (Local): ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    console.warn('⚠️ Server is running but database is not connected. Some functionalities might fail.');
  }
};

module.exports = connectDB;

