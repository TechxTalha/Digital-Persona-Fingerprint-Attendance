const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    cnic: {
      type: String,
      required: [true, 'CNIC number is required'],
      unique: true,
      trim: true,
      match: [/^\d{5}-\d{7}-\d{1}$/, 'Please provide a valid Pakistani CNIC format (e.g. 12345-1234567-1)'],
    },
    role: {
      type: String,
      required: [true, 'Employee role is required'],
      trim: true,
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate must be a non-negative number'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    fingerprintTemplate: {
      type: String,
      required: false,
      trim: true,
    },
    shift: {
      type: String,
      required: [true, 'Shift assignment is required'],
      enum: {
        values: ['Morning', 'Evening', 'Night'],
        message: 'Shift must be Morning, Evening, or Night',
      },
    },
    status: {
      type: String,
      enum: ['Present', 'Absent'],
      default: 'Absent',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Employee', employeeSchema);
