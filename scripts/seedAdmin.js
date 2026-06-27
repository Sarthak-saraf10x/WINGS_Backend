const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wing_tours_travels';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for admin seeding...');

    // Check if admin already exists
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (adminExists) {
      console.log('ℹ️ Admin user already exists. Seeding skipped.');
      process.exit(0);
    }

    // Create default admin user
    const defaultAdmin = new Admin({
      username: 'admin',
      password: 'wings@admin123' // Feel free to update this password in your local .env or via database directly
    });

    await defaultAdmin.save();
    console.log('====================================================');
    console.log('✅ Default Admin account created successfully!');
    console.log('   Username: admin');
    console.log('   Password: wings@admin123');
    console.log('   Please change this password in production!');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error seeding admin user: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
