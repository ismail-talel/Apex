const express = require('express');
const { body, param, query } = require('express-validator');
const complaintController = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

const validateComplaintId = [
  param('id').isMongoId().withMessage('ID de réclamation invalide.')
];

const validateParkingId = [
  param('parkingId').isMongoId().withMessage('ID de parking invalide.')
];

router.post('/', [
  authorize('client'),
  body('parkingId').isMongoId().withMessage('ID de parking invalide.'),
  body('reservationId').optional().isMongoId().withMessage('ID de réservation invalide.'),
  body('subscriptionId').optional().isMongoId().withMessage('ID d\'abonnement invalide.'),
  body('subject').trim().notEmpty().withMessage('Le sujet est requis.').isLength({ max: 120 }),
  body('description').trim().notEmpty().withMessage('La description est requise.').isLength({ max: 2000 }),
  body('category').optional().isIn(['parking', 'reservation', 'payment', 'subscription', 'access', 'staff', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], complaintController.createComplaint);

router.get('/my', authorize('client'), complaintController.getMyComplaints);

router.get('/company', authorize('company'), complaintController.getCompanyComplaints);

router.get('/parking/:parkingId', [
  ...validateParkingId,
  authorize('employee', 'company', 'super_admin'),
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed', 'rejected', 'escalated'])
], complaintController.getParkingComplaints);

router.get('/', [
  authorize('super_admin'),
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed', 'rejected', 'escalated']),
  query('priority').optional().isIn(['low', 'medium', 'high'])
], complaintController.getAllComplaints);

router.get('/:id', [
  ...validateComplaintId,
  authorize('client', 'employee', 'company', 'super_admin')
], complaintController.getComplaintById);

router.put('/:id/respond', [
  ...validateComplaintId,
  authorize('employee', 'company'),
  body('note').trim().notEmpty().withMessage('La réponse est requise.').isLength({ max: 2000 })
], complaintController.respondToComplaint);

router.put('/:id/resolve', [
  ...validateComplaintId,
  authorize('employee', 'company', 'super_admin'),
  body('note').trim().notEmpty().withMessage('La note de résolution est requise.').isLength({ max: 2000 })
], complaintController.resolveComplaint);

router.put('/:id/escalate', [
  ...validateComplaintId,
  authorize('client', 'company')
], complaintController.escalateComplaint);

router.put('/:id/reject', [
  ...validateComplaintId,
  authorize('company', 'super_admin'),
  body('reason').trim().notEmpty().withMessage('Le motif de rejet est requis.').isLength({ max: 500 })
], complaintController.rejectComplaint);

router.put('/:id/close', [
  ...validateComplaintId,
  authorize('client', 'super_admin')
], complaintController.closeComplaint);

module.exports = router;
