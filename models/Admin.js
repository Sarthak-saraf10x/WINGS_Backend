const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true,
    default: ''
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'DISPATCHER', 'admin', 'user'],
    default: 'DISPATCHER'
  },
  status: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'SYSTEM'
  }
}, {
  timestamps: true
});

// Normalize role to uppercase before saving
AdminSchema.pre('save', async function (next) {
  if (this.role) {
    const upper = this.role.toUpperCase();
    if (upper === 'ADMIN' || upper === 'DISPATCHER') {
      this.role = upper;
    }
  }

  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Helper method to compare passwords
AdminSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);

