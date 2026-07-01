const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const faceAuthController = require('../controllers/faceAuthController');

const router = express.Router();

router.get('/status', faceAuthController.getStatus);

router.post('/verify', [
  body('image').notEmpty().withMessage('Image requise.')
], faceAuthController.verifyFace);

router.post('/enroll', protect, [
  body('image').notEmpty().withMessage('Image requise.')
], faceAuthController.enrollFace);

router.delete('/enroll', protect, faceAuthController.removeFaceEnrollment);

module.exports = router;
