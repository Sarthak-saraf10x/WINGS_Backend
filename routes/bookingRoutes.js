const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { sendBookingNotification } = require('../services/emailService');
const { mockBookings } = require('../config/mockStore');

/**
 * @route   POST /api/bookings
 * @desc    Submit a new reservation/booking
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, pickup, destination, travel_date, people, service, message } = req.body;

    // Validate required fields
    if (!name || !phone || !pickup || !destination || !travel_date || !people || !service) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill in all required fields: name, phone, pickup, destination, travel_date, people, service' 
      });
    }

    // Validate phone number format (10 digits)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const newBooking = {
        _id: 'mock_b_' + Date.now(),
        name,
        phone: cleanPhone,
        pickup,
        destination,
        travelDate: new Date(travel_date),
        people: Number(people),
        service,
        message,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockBookings.push(newBooking);
      return res.status(201).json({
        success: true,
        message: 'Your booking inquiry has been recorded. We will contact you shortly! (Offline Mode)',
        data: newBooking
      });
    }

    // Save booking to DB
    const newBooking = new Booking({
      name,
      phone: cleanPhone,
      pickup,
      destination,
      travelDate: new Date(travel_date),
      people: Number(people),
      service,
      message
    });

    await newBooking.save();

    // Trigger async email notification (won't block the API response)
    sendBookingNotification(newBooking).catch(err => {
      console.error(`Background booking email failed: ${err.message}`);
    });

    res.status(201).json({
      success: true,
      message: 'Your booking inquiry has been recorded. We will contact you shortly!',
      data: newBooking
    });
  } catch (error) {
    console.error(`Error processing booking: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error processing booking request' });
  }
});

module.exports = router;
