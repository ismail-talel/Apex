const mongoose = require('mongoose');

const webAuthnCredentialSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  credentialID: {
    type: String,
    required: true,
    unique: true
  },
  publicKey: {
    type: String,
    required: true
  },
  counter: {
    type: Number,
    default: 0
  },
  deviceType: {
    type: String,
    default: 'singleDevice'
  },
  backedUp: {
    type: Boolean,
    default: false
  },
  transports: [{
    type: String
  }],
  friendlyName: {
    type: String,
    default: 'Passkey'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WebAuthnCredential', webAuthnCredentialSchema);
