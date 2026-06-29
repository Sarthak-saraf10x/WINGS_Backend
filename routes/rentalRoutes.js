const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Rental = require('../models/Rental');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { mockRentals } = require('../config/mockStore');

/**
 * @route   GET /api/rentals
 * @desc    Fetch all rental vehicles
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockRentals.length, data: mockRentals });
    }
    const rentals = await Rental.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: rentals.length, data: rentals });
  } catch (error) {
    console.error(`[Rentals] Fetch error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching rentals' });
  }
});

/**
 * @route   POST /api/rentals
 * @desc    Add a new rental vehicle
 * @access  Private (Admin only)
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { type, capacity, ac, ratePerKm, ratePerDay, minKm, minFare, features } = req.body;

    if (!type || !capacity) {
      return res.status(400).json({ success: false, message: 'Please provide vehicle type and capacity' });
    }

    let imageUrl = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600';
    let imagePublicId = 'mock_rpid';

    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/rentals');
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    } else if (mongoose.connection.readyState === 1) {
      return res.status(400).json({ success: false, message: 'Please upload a vehicle image' });
    }

    if (mongoose.connection.readyState !== 1) {
      const newRental = {
        _id: 'mock_r_' + Date.now(),
        type,
        capacity: Number(capacity),
        ac: ac === 'true' || ac === true,
        ratePerKm: ratePerKm || '',
        ratePerDay: ratePerDay || '',
        minKm: minKm || '',
        minFare: minFare || '',
        features: features || '',
        imageUrl,
        imagePublicId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockRentals.push(newRental);
      return res.status(201).json({ success: true, message: 'Rental added (Offline Mode)', data: newRental });
    }

    const newRental = new Rental({
      type,
      capacity: Number(capacity),
      ac: ac === 'true' || ac === true,
      ratePerKm: ratePerKm || '',
      ratePerDay: ratePerDay || '',
      minKm: minKm || '',
      minFare: minFare || '',
      features: features || '',
      imageUrl,
      imagePublicId
    });

    await newRental.save();
    res.status(201).json({ success: true, message: 'Rental vehicle added successfully', data: newRental });
  } catch (error) {
    console.error(`[Rentals] Add error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error adding rental' });
  }
});

/**
 * @route   DELETE /api/rentals/:id
 * @desc    Delete a rental vehicle
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const idx = mockRentals.findIndex(r => r._id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Rental not found' });
      mockRentals.splice(idx, 1);
      return res.json({ success: true, message: 'Rental deleted (Offline Mode)' });
    }

    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ success: false, message: 'Rental not found' });

    if (rental.imagePublicId) {
      await deleteImage(rental.imagePublicId);
    }
    await Rental.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Rental vehicle deleted successfully' });
  } catch (error) {
    console.error(`[Rentals] Delete error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error deleting rental' });
  }
});

/**
 * @route   PUT /api/rentals/:id
 * @desc    Update rental vehicle details or replace image
 * @access  Private (Admin only)
 */
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { type, capacity, ac, ratePerKm, ratePerDay, minKm, minFare, features } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const rental = mockRentals.find(r => r._id === req.params.id);
      if (!rental) {
        return res.status(404).json({ success: false, message: 'Rental not found' });
      }
      if (type) rental.type = type;
      if (capacity) rental.capacity = Number(capacity);
      if (ac !== undefined) rental.ac = ac === 'true' || ac === true;
      if (ratePerKm !== undefined) rental.ratePerKm = ratePerKm;
      if (ratePerDay !== undefined) rental.ratePerDay = ratePerDay;
      if (minKm !== undefined) rental.minKm = minKm;
      if (minFare !== undefined) rental.minFare = minFare;
      if (features !== undefined) rental.features = features;
      rental.updatedAt = new Date();
      return res.json({ success: true, message: 'Rental updated (Offline Mode)', data: rental });
    }

    let rental = await Rental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (type) rental.type = type;
    if (capacity) rental.capacity = Number(capacity);
    if (ac !== undefined) rental.ac = ac === 'true' || ac === true;
    if (ratePerKm !== undefined) rental.ratePerKm = ratePerKm;
    if (ratePerDay !== undefined) rental.ratePerDay = ratePerDay;
    if (minKm !== undefined) rental.minKm = minKm;
    if (minFare !== undefined) rental.minFare = minFare;
    if (features !== undefined) rental.features = features;

    if (req.file) {
      if (rental.imagePublicId) {
        await deleteImage(rental.imagePublicId);
      }
      const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/rentals');
      rental.imageUrl = uploadResult.secure_url;
      rental.imagePublicId = uploadResult.public_id;
    }

    await rental.save();
    res.json({ success: true, message: 'Rental vehicle updated successfully', data: rental });
  } catch (error) {
    console.error(`[Rentals] Update error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating rental' });
  }
});

module.exports = router;
