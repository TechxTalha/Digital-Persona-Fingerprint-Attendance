const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'alkaram_jwt_secret_key_2026', {
    expiresIn: '30d',
  });
};

// @desc    Auth admin & get token
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both username and password.' });
    }

    // Find admin by username (lowercase check)
    const admin = await Admin.findOne({ username: username.toLowerCase() });

    if (admin && (await admin.matchPassword(password))) {
      res.status(200).json({
        success: true,
        token: generateToken(admin._id),
        admin: {
          id: admin._id,
          username: admin.username,
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current admin profile
// @route   GET /api/auth/me
// @access  Private (Admin only)
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  loginAdmin,
  getMe,
};
