const Employee = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');
const Payroll = require('../models/Payroll');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Public (or Admin)
const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Public (or Admin)
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new employee
// @route   POST /api/employees
// @access  Public (or Admin)
const createEmployee = async (req, res) => {
  try {
    const { name, cnic, role, hourlyRate, phone, shift } = req.body;

    // Validate unique CNIC
    const existsCNIC = await Employee.findOne({ cnic });
    if (existsCNIC) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this CNIC is already registered.',
      });
    }

    const employee = await Employee.create({
      name,
      cnic,
      role,
      hourlyRate,
      phone,
      shift,
      status: 'Absent',
    });

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update employee details
// @route   PUT /api/employees/:id
// @access  Public (or Admin)
const updateEmployee = async (req, res) => {
  try {
    const { name, cnic, role, hourlyRate, phone, shift, status } = req.body;

    let employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Check unique CNIC if changed
    if (cnic && cnic !== employee.cnic) {
      const existsCNIC = await Employee.findOne({ cnic });
      if (existsCNIC) {
        return res.status(400).json({ success: false, message: 'Employee with this CNIC already exists.' });
      }
    }

    employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, cnic, role, hourlyRate, phone, shift, status },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Public (or Admin)
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Delete attendance logs and payroll records of this employee
    await AttendanceLog.deleteMany({ employeeId: employee._id });
    await Payroll.deleteMany({ employeeId: employee._id });
    await Employee.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Employee and their logs successfully removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Enroll fingerprint template
// @route   POST /api/employees/:id/enroll
// @access  Public (or Admin)
const enrollFingerprint = async (req, res) => {
  try {
    const { png } = req.body;
    if (!png) {
      return res.status(400).json({ success: false, message: 'No PNG image provided for enrollment.' });
    }
    
    // Convert PNG to SourceAFIS template via Java Matcher
    const JAVA_MATCHER_URL = process.env.JAVA_MATCHER_URL || 'http://localhost:8080/match';
    const createRes = await fetch(`${JAVA_MATCHER_URL}/template/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png })
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.success) {
      throw new Error(createData.message || 'Failed to generate fingerprint template from Java Matcher');
    }

    const templateBase64 = createData.template;
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { fingerprintTemplate: templateBase64 },
      { new: true }
    );
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    res.status(200).json({ success: true, message: 'Fingerprint enrolled successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  enrollFingerprint,
};
