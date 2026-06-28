const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { mockVehicles } = require('../config/mockStore');

/**
 * @route   GET /api/vehicles
 * @desc    Fetch all vehicles for the Fleet section
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockVehicles.length, data: mockVehicles });
    }
    const vehicles = await Vehicle.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (error) {
    console.error(`Error fetching vehicles: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching vehicles' });
  }
});

/**
 * @route   POST /api/vehicles
 * @desc    Add a new vehicle to the fleet
 * @access  Private (Admin only)
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { name, type, capacity, fuelType, transmission, ac, features, pricePerKm } = req.body;

    if (!name || !type || !capacity) {
      return res.status(400).json({ success: false, message: 'Please provide vehicle name, type and capacity' });
    }

    if (mongoose.connection.readyState !== 1) {
      const newVehicle = {
        _id: 'mock_v_' + Date.now(),
        name, type,
        capacity: Number(capacity),
        fuelType: fuelType || 'Diesel',
        transmission: transmission || 'Manual',
        ac: ac === 'true' || ac === true,
        features: features || '',
        pricePerKm: pricePerKm || '',
        imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600',
        imagePublicId: 'mock_vpid',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockVehicles.push(newVehicle);
      return res.status(201).json({
        success: true,
        message: 'Vehicle added successfully (Offline Mode)',
        data: newVehicle
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a vehicle image' });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/vehicles');

    const newVehicle = new Vehicle({
      name, type,
      capacity: Number(capacity),
      fuelType: fuelType || 'Diesel',
      transmission: transmission || 'Manual',
      ac: ac === 'true' || ac === true,
      features: features || '',
      pricePerKm: pricePerKm || '',
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id
    });

    await newVehicle.save();

    res.status(201).json({
      success: true,
      message: 'Vehicle added to fleet successfully',
      data: newVehicle
    });
  } catch (error) {
    console.error(`Error adding vehicle: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error adding vehicle' });
  }
});

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle details
 * @access  Private (Admin only)
 */
router.put('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const index = mockVehicles.findIndex(v => v._id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      mockVehicles[index] = { ...mockVehicles[index], ...req.body, updatedAt: new Date() };
      return res.json({ success: true, message: 'Vehicle updated (Offline Mode)', data: mockVehicles[index] });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    res.json({ success: true, message: 'Vehicle updated successfully', data: vehicle });
  } catch (error) {
    console.error(`Error updating vehicle: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating vehicle' });
  }
});

/**
 * @route   DELETE /api/vehicles/:id
 * @desc    Delete a vehicle from fleet
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const index = mockVehicles.findIndex(v => v._id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      mockVehicles.splice(index, 1);
      return res.json({ success: true, message: 'Vehicle deleted (Offline Mode)' });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    if (vehicle.imagePublicId) {
      await deleteImage(vehicle.imagePublicId);
    }

    await Vehicle.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error(`Error deleting vehicle: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error deleting vehicle' });
  }
});

module.exports = router;
