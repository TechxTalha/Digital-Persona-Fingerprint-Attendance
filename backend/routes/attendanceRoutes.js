const express = require('express');
const router = express.Router();
const {
  scanFingerprint,
  punchBiometric,
  getLogs,
  postTempEnrollment,
  getTempEnrollment,
  clearTempEnrollment,
  getTemplates,
} = require('../controllers/attendanceController');
const { protectLocalAgent, protectAdmin } = require('../middleware/auth');

// Fingerprint scan endpoint is protected by API key auth from the local agent
router.post('/scan', protectLocalAgent, scanFingerprint);

// Production biometric identification punch route
router.post('/punch-biometric', punchBiometric);

// Fetch all registered fingerprint templates for local agent verification
router.get('/templates', protectLocalAgent, getTemplates);

// Fetching logs (for admin dashboards) requires admin token
router.get('/logs', protectAdmin, getLogs);

// Biometric enrollment routes (RAM buffer polling for UI auto-fill)
router.post('/enroll-temp', protectLocalAgent, postTempEnrollment);
router.route('/enroll-temp')
  .get(getTempEnrollment)
  .delete(clearTempEnrollment);

module.exports = router;
