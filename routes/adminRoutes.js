const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const Admin = require('../models/Admin');
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const { protect } = require('../middleware/auth');
const { mockBookings, mockEnquiries } = require('../config/mockStore');

/**
 * @route   POST /api/admin/login
 * @desc    Authenticate admin & return token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if fields are provided
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both username and password' });
    }

    // Check if database is connected
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      console.warn('Database is offline. Using local backup credentials verification.');
      if (username === 'admin' && password === 'wings@admin123') {
        const token = jwt.sign(
          { id: 'mock_admin_id' },
          process.env.JWT_SECRET || 'wings_tour_travels_dev_secret_key_123',
          { expiresIn: '30d' }
        );
        return res.json({
          success: true,
          token,
          admin: {
            id: 'mock_admin_id',
            username: 'admin (Local/Offline Mode)'
          }
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials (offline mode)' });
      }
    }

    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET || 'wings_tour_travels_dev_secret_key_123',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role || 'admin'
      }
    });
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

/**
 * @route   GET /api/admin/google-client-id
 * @desc    Get Google OAuth Client ID for frontend login
 * @access  Public
 */
router.get('/google-client-id', (req, res) => {
  res.json({
    success: true,
    clientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

/**
 * @route   GET /api/admin/profile
 * @desc    Get logged in admin profile
 * @access  Protected
 */
router.get('/profile', protect, (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.admin._id || 'mock_admin_id',
      username: req.admin.username,
      email: req.admin.email,
      role: req.admin.role || 'admin'
    }
  });
});

/**
 * @route   POST /api/admin/google-login
 * @desc    Authenticate admin using Google ID Token
 * @access  Public
 */
router.post('/google-login', async (req, res) => {
  const { token } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Google Sign-In is unavailable in database offline/local mode. Please use username and password.'
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'your_google_client_id_placeholder') {
      return res.status(400).json({ 
        success: false, 
        message: 'Google Sign-In is not configured on the server. Please add GOOGLE_CLIENT_ID to the .env file.' 
      });
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // Find admin by googleId or email
    let admin = await Admin.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (!admin) {
      // Check if this matches the owner email
      const ownerEmail = process.env.OWNER_EMAIL || 'wings.tours.booking@gmail.com';
      if (email.toLowerCase() === ownerEmail.toLowerCase()) {
        // Link with existing default 'admin' if available, otherwise create new
        admin = await Admin.findOne({ username: 'admin' });
        if (admin) {
          admin.googleId = googleId;
          admin.email = email.toLowerCase();
          admin.role = 'admin';
          await admin.save();
        } else {
          admin = new Admin({
            username: email.split('@')[0],
            email: email.toLowerCase(),
            googleId,
            role: 'admin'
          });
          await admin.save();
        }
      } else {
        // Create user account for standard clients
        admin = new Admin({
          username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6),
          email: email.toLowerCase(),
          googleId,
          role: 'user'
        });
        await admin.save();
      }
    } else {
      // Update googleId and email if they were not linked yet
      let modified = false;
      if (!admin.googleId) {
        admin.googleId = googleId;
        modified = true;
      }
      if (!admin.email) {
        admin.email = email.toLowerCase();
        modified = true;
      }
      // If the email is the owner email and role is not admin, promote to admin
      const ownerEmail = process.env.OWNER_EMAIL || 'wings.tours.booking@gmail.com';
      if (email.toLowerCase() === ownerEmail.toLowerCase() && admin.role !== 'admin') {
        admin.role = 'admin';
        modified = true;
      }
      if (modified) {
        await admin.save();
      }
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET || 'wings_tour_travels_dev_secret_key_123',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role || 'user'
      }
    });

  } catch (error) {
    console.error(`Google Login error: ${error.message}`);
    res.status(500).json({ success: false, message: `Google authentication failed: ${error.message}` });
  }
});

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all bookings (sorted by newest)
 * @access  Private (Admin only)
 */
router.get('/bookings', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockBookings.length, data: [...mockBookings].sort((a, b) => b.createdAt - a.createdAt) });
    }
    const bookings = await Booking.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error(`Error retrieving bookings: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error retrieving bookings' });
  }
});

/**
 * @route   PUT /api/admin/bookings/:id
 * @desc    Update a booking's status
 * @access  Private (Admin only)
 */
router.put('/bookings/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      const booking = mockBookings.find(b => b._id === req.params.id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      booking.status = status;
      booking.updatedAt = new Date();
      return res.json({ success: true, data: booking });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error(`Error updating booking status: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating booking' });
  }
});

/**
 * @route   GET /api/admin/enquiries
 * @desc    Get all contact enquiries (sorted by newest)
 * @access  Private (Admin only)
 */
router.get('/enquiries', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockEnquiries.length, data: [...mockEnquiries].sort((a, b) => b.createdAt - a.createdAt) });
    }
    const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: enquiries.length, data: enquiries });
  } catch (error) {
    console.error(`Error retrieving enquiries: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error retrieving enquiries' });
  }
});

/**
 * @route   PUT /api/admin/enquiries/:id
 * @desc    Update an enquiry's status
 * @access  Private (Admin only)
 */
router.put('/enquiries/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      const enquiry = mockEnquiries.find(e => e._id === req.params.id);
      if (!enquiry) {
        return res.status(404).json({ success: false, message: 'Enquiry not found' });
      }
      enquiry.status = status;
      enquiry.updatedAt = new Date();
      return res.json({ success: true, data: enquiry });
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    enquiry.status = status;
    await enquiry.save();

    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error(`Error updating enquiry status: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating enquiry' });
  }
});

module.exports = router;
