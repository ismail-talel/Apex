// src/routes/payment.js
const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Webhook Konnect (public — appelé par Konnect après paiement)
router.get('/konnect/webhook', paymentController.konnectWebhook);

// Page mock pour développement sans clés API
router.get('/konnect/mock-pay', paymentController.konnectMockPayPage);

module.exports = router;
