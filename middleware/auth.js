const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (format: Bearer TOKEN)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wings_tour_travels_dev_secret_key_123');

      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        if (decoded.id === 'mock_admin_id') {
          req.admin = { id: 'mock_admin_id', username: 'admin (Local/Offline Mode)' };
          return next();
        }
      }

      // Find the admin in database (excluding the password)
      req.admin = await Admin.findById(decoded.id).select('-password');

      if (!req.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
      }

      next();
    } catch (error) {
      console.error(`JWT verification error: ${error.message}`);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
