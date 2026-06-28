const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  reference: {
    type: String,
    unique: true,
    default: () => `REC-${Date.now().toString(36).toUpperCase()}`
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parkingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parking',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  category: {
    type: String,
    enum: ['parking', 'reservation', 'payment', 'subscription', 'access', 'staff', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed', 'rejected', 'escalated'],
    default: 'pending'
  },
  responseNote: {
    type: String,
    default: null,
    maxlength: 2000
  },
  resolutionNote: {
    type: String,
    default: null,
    maxlength: 2000
  },
  rejectReason: {
    type: String,
    default: null,
    maxlength: 500
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  respondedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  escalatedAt: { type: Date, default: null }
}, {
  timestamps: true
});

complaintSchema.index({ clientId: 1, createdAt: -1 });
complaintSchema.index({ companyId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ parkingId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
