const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Package = require('../models/Package');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { mockPackages } = require('../config/mockStore');

/**
 * @route   GET /api/packages/featured
 * @desc    Fetch all featured and active packages for frontend
 * @access  Public
 */
router.get('/featured', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const filtered = mockPackages.filter(p => p.isFeatured && p.isActive);
      return res.json({ success: true, count: filtered.length, data: filtered });
    }
    const packages = await Package.find({ isFeatured: true, isActive: true });
    res.json({ success: true, count: packages.length, data: packages });
  } catch (error) {
    console.error(`Error fetching featured packages: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching packages' });
  }
});

/**
 * @route   GET /api/packages
 * @desc    Fetch all packages (for admin listing)
 * @access  Public (Optionally protect or leave open)
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockPackages.length, data: mockPackages });
    }
    const packages = await Package.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: packages.length, data: packages });
  } catch (error) {
    console.error(`Error fetching all packages: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching packages' });
  }
});

router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, duration, rating, price, description, isFeatured, isActive, badge, category } = req.body;

    // Validate fields
    if (!title || !duration || !price || !description) {
      return res.status(400).json({ success: false, message: 'Please provide title, duration, price and description' });
    }

    if (mongoose.connection.readyState !== 1) {
      const newPackage = {
        _id: 'mock_p_' + Date.now(),
        title,
        duration,
        rating: rating ? Number(rating) : 5.0,
        price,
        description,
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600',
        imagePublicId: 'mock_pid',
        isFeatured: isFeatured === 'false' || isFeatured === false ? false : true,
        isActive: isActive === 'false' || isActive === false ? false : true,
        badge,
        category,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPackages.push(newPackage);
      return res.status(201).json({
        success: true,
        message: 'Tour package created successfully (Offline Mode)',
        data: newPackage
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a tour package cover photo' });
    }

    // Stream upload file buffer to Cloudinary
    const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/packages');

    // Create package object
    const newPackage = new Package({
      title,
      duration,
      rating: rating ? Number(rating) : 5.0,
      price,
      description,
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
      isFeatured: isFeatured === 'false' ? false : true,
      isActive: isActive === 'false' ? false : true,
      badge,
      category
    });

    await newPackage.save();

    res.status(201).json({
      success: true,
      message: 'Tour package created successfully',
      data: newPackage
    });
  } catch (error) {
    console.error(`Error creating package: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error creating package' });
  }
});

/**
 * @route   PUT /api/packages/:id
 * @desc    Update package details or change image
 * @access  Private (Admin only)
 */
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, duration, rating, price, description, isFeatured, isActive, badge, category } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const packageItem = mockPackages.find(p => p._id === req.params.id);
      if (!packageItem) {
        return res.status(404).json({ success: false, message: 'Tour package not found' });
      }
      if (title) packageItem.title = title;
      if (duration) packageItem.duration = duration;
      if (rating !== undefined) packageItem.rating = Number(rating);
      if (price) packageItem.price = price;
      if (description) packageItem.description = description;
      if (badge !== undefined) packageItem.badge = badge;
      if (category !== undefined) packageItem.category = category;
      if (isFeatured !== undefined) {
        packageItem.isFeatured = isFeatured === 'true' || isFeatured === true;
      }
      if (isActive !== undefined) {
        packageItem.isActive = isActive === 'true' || isActive === true;
      }
      packageItem.updatedAt = new Date();
      return res.json({
        success: true,
        message: 'Tour package updated successfully (Offline Mode)',
        data: packageItem
      });
    }

    let packageItem = await Package.findById(req.params.id);

    if (!packageItem) {
      return res.status(404).json({ success: false, message: 'Tour package not found' });
    }

    // Update simple fields
    if (title) packageItem.title = title;
    if (duration) packageItem.duration = duration;
    if (rating !== undefined) packageItem.rating = Number(rating);
    if (price) packageItem.price = price;
    if (description) packageItem.description = description;
    if (badge !== undefined) packageItem.badge = badge;
    if (category !== undefined) packageItem.category = category;
    
    if (isFeatured !== undefined) {
      packageItem.isFeatured = isFeatured === 'true' || isFeatured === true;
    }
    if (isActive !== undefined) {
      packageItem.isActive = isActive === 'true' || isActive === true;
    }

    // Check if new image is uploaded
    if (req.file) {
      // 1. Delete old image from Cloudinary (if public ID exists)
      if (packageItem.imagePublicId) {
        await deleteImage(packageItem.imagePublicId);
      }
      
      // 2. Upload new image
      const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/packages');
      packageItem.imageUrl = uploadResult.secure_url;
      packageItem.imagePublicId = uploadResult.public_id;
    }

    await packageItem.save();

    res.json({
      success: true,
      message: 'Tour package updated successfully',
      data: packageItem
    });
  } catch (error) {
    console.error(`Error updating package: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating package' });
  }
});

/**
 * @route   DELETE /api/packages/:id
 * @desc    Delete a package and remove its image from Cloudinary
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const index = mockPackages.findIndex(p => p._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Tour package not found' });
      }
      mockPackages.splice(index, 1);
      return res.json({
        success: true,
        message: 'Tour package deleted successfully (Offline Mode)'
      });
    }

    const packageItem = await Package.findById(req.params.id);
    if (!packageItem) {
      return res.status(404).json({ success: false, message: 'Tour package not found' });
    }

    // Delete image from Cloudinary
    if (packageItem.imagePublicId) {
      await deleteImage(packageItem.imagePublicId);
    }

    // Delete from database
    await Package.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Tour package deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting package: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error deleting package' });
  }
});

module.exports = router;
