const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const { fetchGoogleReviews } = require('../services/cronService');
const { protect } = require('../middleware/auth');
const { mockReviews } = require('../config/mockStore');

/**
 * @route   GET /api/reviews
 * @desc    Fetch all cached 5-star Google Reviews
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockReviews.length, data: mockReviews });
    }
    const reviews = await Review.find({ isVisible: true }).sort({ time: -1, createdAt: -1 });
    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    console.error(`Error retrieving cached reviews: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error retrieving reviews' });
  }
});

/**
 * @route   POST /api/reviews/sync
 * @desc    Force sync reviews from Google Places API
 * @access  Private (Admin only)
 */
router.post('/sync', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cannot sync reviews: database is offline.' });
    }
    await fetchGoogleReviews();
    const reviews = await Review.find({});
    res.json({ success: true, message: 'Google reviews synchronized successfully', count: reviews.length, data: reviews });
  } catch (error) {
    console.error(`Sync error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error syncing Google Reviews' });
  }
});

module.exports = router;
