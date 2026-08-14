const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  enrollFingerprint,
} = require('../controllers/employeeController');
const { protectAdmin } = require('../middleware/auth');

// Protect all employee routes
router.use(protectAdmin);

router.route('/')
  .get(getEmployees)
  .post(createEmployee);

router.route('/:id')
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.route('/:id/enroll')
  .post(enrollFingerprint);

module.exports = router;
