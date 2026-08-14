const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');
const TempEnrollment = require('../models/TempEnrollment');

// @desc    Process a fingerprint scan from the local agent
// @route   POST /api/attendance/scan
// @access  Private (Local Agent API Key required)
const scanFingerprint = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    // Find the employee by ID
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `No employee registered with ID: ${employeeId}`,
      });
    }

    const currentTime = new Date();
    const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
    const AUTO_CLOSE_MS = 12 * 60 * 60 * 1000; // 12 hours buffer to auto-close previous shift

    // Find the employee's last log
    const lastLog = await AttendanceLog.findOne({ employeeId: employee._id }).sort({ checkIn: -1 });

    if (lastLog) {
      // Determine the timestamp of the last scan activity
      const lastScanTime = lastLog.checkOut ? lastLog.checkOut : lastLog.checkIn;
      
      // Cooldown block check
      if (currentTime.getTime() - lastScanTime.getTime() < COOLDOWN_MS) {
        return res.status(200).json({
          success: true,
          message: `Scan ignored. 10-minute cooldown active. Last scan was ${Math.round((currentTime.getTime() - lastScanTime.getTime()) / 60000)} minutes ago.`,
          status: 'Cooldown',
          employee: { name: employee.name, cnic: employee.cnic, role: employee.role, shift: employee.shift },
          log: lastLog,
        });
      }

      // Check if there is an active check-in (checkOut is null)
      if (lastLog.checkOut === null) {
        // If the check-in is older than 12 hours, assume they forgot to check out
        if (currentTime.getTime() - lastLog.checkIn.getTime() > AUTO_CLOSE_MS) {
          // Auto-checkout the previous log at check-in time + 8 hours
          const shiftDurationHours = 8;
          lastLog.checkOut = new Date(lastLog.checkIn.getTime() + shiftDurationHours * 60 * 60 * 1000);
          lastLog.duration = shiftDurationHours;
          lastLog.autoCheckedOut = true;
          await lastLog.save();

          // Open a new check-in for the current scan
          const newLog = await AttendanceLog.create({
            employeeId: employee._id,
            checkIn: currentTime,
            checkOut: null,
            duration: 0,
            shift: employee.shift,
            autoCheckedOut: false,
          });

          // Update employee status to Present
          employee.status = 'Present';
          await employee.save();

          return res.status(201).json({
            success: true,
            message: `Previous check-in auto-closed (exceeded shift hours). New Check-In registered.`,
            status: 'Check-In',
            employee: { name: employee.name, cnic: employee.cnic, role: employee.role, shift: employee.shift },
            log: newLog,
          });
        } else {
          // Normal Check-Out
          lastLog.checkOut = currentTime;
          const diffMs = currentTime.getTime() - lastLog.checkIn.getTime();
          const durationHours = diffMs / (1000 * 60 * 60);
          lastLog.duration = parseFloat(durationHours.toFixed(2));
          lastLog.autoCheckedOut = false;
          await lastLog.save();

          // Update employee status to Absent
          employee.status = 'Absent';
          await employee.save();

          return res.status(200).json({
            success: true,
            message: `Check-Out registered successfully.`,
            status: 'Check-Out',
            employee: { name: employee.name, cnic: employee.cnic, role: employee.role, shift: employee.shift },
            log: lastLog,
          });
        }
      }
    }

    // No active check-in, perform Check-In
    const newLog = await AttendanceLog.create({
      employeeId: employee._id,
      checkIn: currentTime,
      checkOut: null,
      duration: 0,
      shift: employee.shift,
      autoCheckedOut: false,
    });

    // Update employee status to Present
    employee.status = 'Present';
    await employee.save();

    return res.status(201).json({
      success: true,
      message: `Check-In registered successfully.`,
      status: 'Check-In',
      employee: { name: employee.name, cnic: employee.cnic, role: employee.role, shift: employee.shift },
      log: newLog,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process biometric punch from frontend Kiosk via SourceAFIS
// @route   POST /api/attendance/punch-biometric
// @access  Public
const punchBiometric = async (req, res) => {
  try {
    const { png } = req.body;
    if (!png) {
      return res.status(400).json({ success: false, message: 'PNG image required.' });
    }

    // 1. Fetch all employees that have a registered fingerprint template
    const candidates = await Employee.find(
      { fingerprintTemplate: { $exists: true, $ne: '' } },
      '_id fingerprintTemplate name'
    );

    if (candidates.length === 0) {
      return res.status(404).json({ success: false, message: 'No employees are enrolled with biometrics yet.' });
    }

    // Format for Java Matcher Identify Endpoint
    const candidateList = candidates.map(emp => ({
      id: emp._id.toString(),
      template: emp.fingerprintTemplate
    }));

    // 2. Send Probe PNG and Candidate Templates to Java Matcher
    const JAVA_MATCHER_URL = process.env.JAVA_MATCHER_URL || 'http://localhost:8080';
    const matchRes = await fetch(`${JAVA_MATCHER_URL}/match/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        probePng: png,
        candidates: candidateList
      })
    });

    const matchData = await matchRes.json();
    console.log('[Punch Biometric] Java Matcher Response:', matchData);
    
    if (!matchRes.ok) {
      throw new Error(matchData.message || 'Error communicating with Java Matcher');
    }

    // 3. Evaluate matching score (Threshold 30 - lowered for better UX)
    if (!matchData.matchId || matchData.score < 30) {
      return res.status(401).json({ 
        success: false, 
        message: 'Fingerprint not recognized.',
        details: 'Score too low.'
      });
    }

    const matchedEmployeeId = matchData.matchId;
    
    // 4. Delegate to the core logic of recording attendance
    // We mock the req object slightly to reuse scanFingerprint logic
    req.body.employeeId = matchedEmployeeId;
    return scanFingerprint(req, res);

  } catch (error) {
    console.error('Punch Biometric Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error during identification.' });
  }
};

// @desc    Get attendance logs
// @route   GET /api/attendance/logs
// @access  Public (or Admin)
const getLogs = async (req, res) => {
  try {
    const { employeeId, shift, startDate, endDate } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (shift) {
      query.shift = shift;
    }

    // Date filters
    if (startDate || endDate) {
      query.checkIn = {};
      if (startDate) {
        query.checkIn.$gte = new Date(startDate);
      }
      if (endDate) {
        // Extend to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.checkIn.$lte = end;
      }
    }

    const logs = await AttendanceLog.find(query)
      .populate('employeeId', 'name cnic role hourlyRate shift')
      .sort({ checkIn: -1 });

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const fs = require('fs');
const path = require('path');
const backendLogPath = path.join(__dirname, '../backend_debug.log');

function logBackend(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(backendLogPath, line + '\n');
  } catch (e) {}
}

// In-Memory RAM Buffer (Retained for 2 minutes for UI auto-fill)
let inMemoryEnrollmentBuffer = null;
let inMemoryEnrollmentTime = 0;

// @desc    Post temporary fingerprint scan for UI auto-fill (RAM memory only)
// @route   POST /api/attendance/enroll-temp
// @access  Private (Local Agent API Key required)
const postTempEnrollment = async (req, res) => {
  try {
    const { fingerprintTemplateId } = req.body;
    logBackend(`POST /enroll-temp (RAM Memory) received templateId: ${fingerprintTemplateId}`);

    if (!fingerprintTemplateId) {
      return res.status(400).json({ success: false, message: 'Template ID is required.' });
    }

    inMemoryEnrollmentBuffer = fingerprintTemplateId;
    inMemoryEnrollmentTime = Date.now();
    logBackend(`✓ In-memory RAM buffer set to: ${inMemoryEnrollmentBuffer}`);

    res.status(200).json({
      success: true,
      message: 'Fingerprint template buffered in RAM for UI auto-fill.',
      fingerprintTemplateId,
    });
  } catch (error) {
    logBackend(`✗ POST /enroll-temp Error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get temporary fingerprint scan from RAM memory (persistent until DELETE or 60s expiry)
// @route   GET /api/attendance/enroll-temp
// @access  Private
const getTempEnrollment = async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    let templateId = inMemoryEnrollmentBuffer;

    // Auto-expire after 60 seconds to prevent stale data
    if (templateId && (Date.now() - inMemoryEnrollmentTime > 60000)) {
      logBackend(`⏰ Buffer expired (60s). Clearing stale template: ${templateId}`);
      inMemoryEnrollmentBuffer = null;
      inMemoryEnrollmentTime = 0;
      templateId = null;
    }

    if (templateId) {
      logBackend(`✓ GET /enroll-temp returning RAM template: ${templateId}`);
    }

    res.status(200).json({
      success: true,
      fingerprintTemplateId: templateId || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear temporary in-memory fingerprint buffer
// @route   DELETE /api/attendance/enroll-temp
// @access  Private
const clearTempEnrollment = async (req, res) => {
  try {
    inMemoryEnrollmentBuffer = null;
    logBackend(`🧹 In-memory RAM biometrics buffer cleared on admin demand.`);
    res.status(200).json({ success: true, message: 'In-memory biometrics buffer cleared.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all enrolled fingerprint templates
// @route   GET /api/attendance/templates
// @access  Private (Local Agent API Key required)
const getTemplates = async (req, res) => {
  try {
    const employees = await Employee.find({ fingerprintTemplateId: { $exists: true, $ne: '' } }, '_id fingerprintTemplateId');
    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  scanFingerprint,
  punchBiometric,
  getLogs,
  postTempEnrollment,
  getTempEnrollment,
  clearTempEnrollment,
  getTemplates,
};
