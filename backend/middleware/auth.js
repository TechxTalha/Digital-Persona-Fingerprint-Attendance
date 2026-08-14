const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectLocalAgent = (req, res, next) => {
  const agentKey = req.headers['x-local-agent-key'];
  const expectedKey = process.env.LOCAL_AGENT_API_KEY || 'alkaram_secret_agent_key_2026';

  if (!agentKey || agentKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing local agent API key in headers.',
    });
  }

  next();
};

const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (Bearer <token>)
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'alkaram_jwt_secret_key_2026');

      // Get admin from the token
      req.admin = await Admin.findById(decoded.id).select('-password');
      if (!req.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized, admin user not found.' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
  }
};

module.exports = { protectLocalAgent, protectAdmin };
