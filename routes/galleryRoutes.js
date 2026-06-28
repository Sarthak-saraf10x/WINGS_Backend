const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { mockGallery } = require('../config/mockStore');

/**
 * @route   GET /api/gallery
 * @desc    Fetch all tour images for the gallery
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockGallery.length, data: mockGallery });
    }
    const galleryItems = await Gallery.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: galleryItems.length, data: galleryItems });
  } catch (error) {
    console.error(`Error fetching gallery: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching gallery' });
  }
});

/**
 * @route   POST /api/gallery
 * @desc    Upload a new photo to the gallery
 * @access  Private (Admin only)
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'Please provide a title and category' });
    }

    let imageUrl = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600';
    let imagePublicId = 'mock_gpid';

    if (req.file) {
      // Stream upload file buffer to Cloudinary
      const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/gallery');
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    } else if (mongoose.connection.readyState === 1) {
      return res.status(400).json({ success: false, message: 'Please upload a gallery image file' });
    }

    if (mongoose.connection.readyState !== 1) {
      const newItem = {
        _id: 'mock_g_' + Date.now(),
        title,
        category,
        description,
        imageUrl,
        imagePublicId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGallery.push(newItem);
      return res.status(201).json({
        success: true,
        message: 'Photo uploaded to gallery successfully (Offline Mode)',
        data: newItem
      });
    }

    // Create gallery item in database
    const newItem = new Gallery({
      title,
      category,
      description,
      imageUrl,
      imagePublicId
    });

    await newItem.save();

    res.status(201).json({
      success: true,
      message: 'Photo uploaded to gallery successfully',
      data: newItem
    });
  } catch (error) {
    console.error(`[Gallery] Upload error: ${error.name} — ${error.message}`);
    if (error.http_code) console.error(`[Gallery] Cloudinary HTTP ${error.http_code}`);
    res.status(500).json({ success: false, message: error.message || 'Server error uploading gallery photo' });
  }
});

/**
 * @route   DELETE /api/gallery/:id
 * @desc    Delete a gallery photo and clean it up from Cloudinary
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const index = mockGallery.findIndex(g => g._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Gallery item not found' });
      }
      mockGallery.splice(index, 1);
      return res.json({
        success: true,
        message: 'Gallery item deleted successfully (Offline Mode)'
      });
    }

    const galleryItem = await Gallery.findById(req.params.id);
    if (!galleryItem) {
      return res.status(404).json({ success: false, message: 'Gallery item not found' });
    }

    // Delete image from Cloudinary
    if (galleryItem.imagePublicId) {
      await deleteImage(galleryItem.imagePublicId);
    }

    // Delete from DB
    await Gallery.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting gallery item: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error deleting gallery item' });
  }
});

/**
 * @route   PUT /api/gallery/:id
 * @desc    Update gallery photo details or replace image
 * @access  Private (Admin only)
 */
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const item = mockGallery.find(g => g._id === req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Gallery item not found' });
      }
      if (title) item.title = title;
      if (category) item.category = category;
      if (description !== undefined) item.description = description;
      if (req.file) {
        try {
          const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/gallery');
          item.imageUrl = uploadResult.secure_url;
          item.imagePublicId = uploadResult.public_id;
        } catch (uploadError) {
          item.imageUrl = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600';
          item.imagePublicId = 'mock_gpid_edited';
        }
      }
      item.updatedAt = new Date();
      return res.json({
        success: true,
        message: 'Gallery item updated successfully (Offline Mode)',
        data: item
      });
    }

    let item = await Gallery.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Gallery item not found' });
    }

    if (title) item.title = title;
    if (category) item.category = category;
    if (description !== undefined) item.description = description;

    if (req.file) {
      // Delete old image
      if (item.imagePublicId) {
        await deleteImage(item.imagePublicId);
      }
      // Upload new image
      const uploadResult = await uploadImage(req.file.buffer, 'wings_tours/gallery');
      item.imageUrl = uploadResult.secure_url;
      item.imagePublicId = uploadResult.public_id;
    }

    await item.save();
    res.json({
      success: true,
      message: 'Gallery item updated successfully',
      data: item
    });
  } catch (error) {
    console.error(`Error updating gallery item: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error updating gallery item' });
  }
});

module.exports = router;
