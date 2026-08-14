const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    month: {
      type: String, // Format "YYYY-MM" (e.g. "2026-06")
      required: true,
    },
    totalHours: {
      type: Number,
      required: true,
      min: [0, 'Total hours cannot be negative'],
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: [0, 'Hourly rate cannot be negative'],
    },
    grossSalary: {
      type: Number,
      required: true,
      min: [0, 'Gross salary cannot be negative'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index so that an employee only has one payroll record per month
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
