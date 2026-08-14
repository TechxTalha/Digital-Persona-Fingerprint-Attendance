const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');

// @desc    Calculate and save monthly payroll for an employee
// @route   POST /api/payroll/calculate
// @access  Public (or Admin)
const calculatePayroll = async (req, res) => {
  try {
    const { employeeId, month } = req.body;

    if (!employeeId || !month) {
      return res.status(400).json({ success: false, message: 'Employee ID and Month (YYYY-MM) are required.' });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Month must be in YYYY-MM format.' });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Calculate start and end range for the month
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed month

    // Create UTC date ranges
    const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

    // Fetch all logs within this range that have completed check-outs
    const logs = await AttendanceLog.find({
      employeeId,
      checkIn: { $gte: startDate, $lte: endDate },
      checkOut: { $ne: null },
    });

    // Sum total duration (hours worked)
    const totalHours = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const hourlyRate = employee.hourlyRate;
    const grossSalary = Math.round(totalHours * hourlyRate);

    // Find if payroll already exists for this employee + month
    let payroll = await Payroll.findOne({ employeeId, month });

    if (payroll) {
      payroll.totalHours = parseFloat(totalHours.toFixed(2));
      payroll.hourlyRate = hourlyRate;
      payroll.grossSalary = grossSalary;
      payroll.processedAt = new Date();
      await payroll.save();
    } else {
      payroll = await Payroll.create({
        employeeId,
        month,
        totalHours: parseFloat(totalHours.toFixed(2)),
        hourlyRate,
        grossSalary,
        status: 'Pending',
        processedAt: new Date(),
      });
    }

    // Populate employee details for response
    const populatedPayroll = await Payroll.findById(payroll._id).populate('employeeId', 'name cnic role shift');

    res.status(200).json({
      success: true,
      message: `Payroll calculated successfully for ${month}.`,
      data: populatedPayroll,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all payroll history
// @route   GET /api/payroll/history
// @access  Public (or Admin)
const getPayrollHistory = async (req, res) => {
  try {
    const { month, employeeId, status } = req.query;
    const query = {};

    if (month) query.month = month;
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const payrolls = await Payroll.find(query)
      .populate('employeeId', 'name cnic role hourlyRate shift')
      .sort({ month: -1, grossSalary: -1 });

    res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payroll payment status
// @route   PUT /api/payroll/:id/status
// @access  Public (or Admin)
const updatePayrollStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['Pending', 'Paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status (Pending or Paid) is required.' });
    }

    const payroll = await Payroll.findById(req.params.id).populate('employeeId', 'name cnic role shift');

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    payroll.status = status;
    await payroll.save();

    res.status(200).json({ success: true, message: `Payroll status updated to ${status}.`, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  calculatePayroll,
  getPayrollHistory,
  updatePayrollStatus,
};
