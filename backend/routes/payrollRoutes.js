const express = require('express');
const router = express.Router();
const {
  calculatePayroll,
  getPayrollHistory,
  updatePayrollStatus,
} = require('../controllers/payrollController');
const { protectAdmin } = require('../middleware/auth');

// Protect all payroll routes
router.use(protectAdmin);

router.post('/calculate', calculatePayroll);
router.get('/history', getPayrollHistory);
router.put('/:id/status', updatePayrollStatus);

module.exports = router;
