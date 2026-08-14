const mongoose = require('mongoose');

const tempEnrollmentSchema = new mongoose.Schema(
  {
    fingerprintTemplateId: {
      type: String,
      required: [true, 'Fingerprint template ID is required.'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // Document expires in 300 seconds (5 minutes)
    },
  }
);

module.exports = mongoose.model('TempEnrollment', tempEnrollmentSchema);
