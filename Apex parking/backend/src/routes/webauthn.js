const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const webauthnController = require('../controllers/webauthnController');

const router = express.Router();

const checkValidation = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/login/options', [
  body('email').isEmail().withMessage('Email invalide.')
], checkValidation, webauthnController.getAuthenticationOptions);

router.post('/login/verify', [
  body('email').isEmail().withMessage('Email invalide.'),
  body('id').notEmpty().withMessage('Réponse WebAuthn invalide.')
], checkValidation, webauthnController.verifyAuthentication);

router.post('/register/options', protect, webauthnController.getRegistrationOptions);

router.post('/register/verify', protect, webauthnController.verifyRegistration);

router.get('/credentials', protect, webauthnController.listCredentials);

router.delete('/credentials/:id', protect, webauthnController.deleteCredential);

module.exports = router;
