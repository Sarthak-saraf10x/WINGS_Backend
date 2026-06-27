const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const { sendEnquiryNotification } = require('../services/emailService');
const { mockEnquiries } = require('../config/mockStore');

/**
 * @route   POST /api/contact
 * @desc    Submit a new contact/enquiry lead
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;

    // Validate required fields
    if (!name || !phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill in all required fields: name, phone, and message' 
      });
    }

    // Clean phone number (10 digits)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const newEnquiry = {
        _id: 'mock_e_' + Date.now(),
        name,
        phone: cleanPhone,
        email,
        message,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEnquiries.push(newEnquiry);
      return res.status(201).json({
        success: true,
        message: 'Thank you for reaching out. We have logged your request! (Offline Mode)',
        data: newEnquiry
      });
    }

    // Create enquiry
    const newEnquiry = new Enquiry({
      name,
      phone: cleanPhone,
      email,
      message
    });

    await newEnquiry.save();

    // Trigger async email notification
    sendEnquiryNotification(newEnquiry).catch(err => {
      console.error(`Background contact email failed: ${err.message}`);
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out. We have logged your request!',
      data: newEnquiry
    });
  } catch (error) {
    console.error(`Error processing contact form: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error processing contact enquiry' });
  }
});

module.exports = router;
