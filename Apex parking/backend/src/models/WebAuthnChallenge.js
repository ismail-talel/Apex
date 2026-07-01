const mongoose = require('mongoose');

const webAuthnChallengeSchema = new mongoose.Schema({
  challenge: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    default: null
  },
  type: {
    type: String,
    enum: ['registration', 'authentication'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WebAuthnChallenge', webAuthnChallengeSchema);
