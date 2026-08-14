const express = require('express');
const router = express.Router();
const { loginAdmin, getMe } = require('../controllers/authController');
const { protectAdmin } = require('../middleware/auth');

router.post('/login', loginAdmin);
router.get('/me', protectAdmin, getMe);

module.exports = router;
