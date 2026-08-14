const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0, // In hours (e.g. 7.5 hours)
    },
    shift: {
      type: String,
      enum: ['Morning', 'Evening', 'Night'],
      required: true,
    },
    autoCheckedOut: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compiles indexes to speed up lookup for employee's last scan
attendanceLogSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
