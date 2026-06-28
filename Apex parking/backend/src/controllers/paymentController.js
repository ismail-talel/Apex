// src/controllers/paymentController.js
const reservationService = require('../services/ReservationService');

/** Webhook Konnect (GET ?payment_ref=...) */
exports.konnectWebhook = async (req, res, next) => {
  try {
    const paymentRef = req.query.payment_ref;
    if (!paymentRef) {
      return res.status(400).json({ success: false, message: 'payment_ref manquant.' });
    }

    try {
      const result = await reservationService.completePaymentFromKonnect(paymentRef);
      return res.status(200).json(result);
    } catch (reservationErr) {
      if (reservationErr.statusCode !== 404 && reservationErr.name !== 'NotFoundError') {
        throw reservationErr;
      }
    }

    const subscriptionController = require('./subscriptionController');
    const result = await subscriptionController.completeSubscriptionPaymentFromKonnect(paymentRef);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/** Page mock pour tests sans clés Konnect */
exports.konnectMockPayPage = async (req, res) => {
  const { payment_ref: paymentRef, reservationId, subscriptionId } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';

  if (!paymentRef || (!reservationId && !subscriptionId)) {
    return res.status(400).send('Paramètres manquants.');
  }

  let returnUrl;
  if (subscriptionId) {
    returnUrl = `${frontendUrl}/client?section=subscriptions&payment=success&subscriptionId=${subscriptionId}&payment_ref=${paymentRef}`;
  } else {
    returnUrl = `${frontendUrl}/client?section=reservations&payment=success&reservationId=${reservationId}&payment_ref=${paymentRef}`;
  }

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Paiement Konnect (mode test)</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f1a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1a1a2e; border: 1px solid #6366f1; border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center; }
    h1 { color: #6366f1; font-size: 1.25rem; }
    p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
    .btn { display: inline-block; margin-top: 1.5rem; padding: 0.85rem 1.5rem; background: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .badge { background: #f59e0b; color: #111; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">MODE TEST</span>
    <h1>💳 Konnect — Carte bancaire</h1>
    <p>Simulation de paiement tunisien (Konnect).<br>En production, vous serez redirigé vers la page sécurisée Konnect.</p>
    <p><small>Réf. : ${paymentRef}</small></p>
    <a class="btn" href="${returnUrl}">Simuler paiement réussi</a>
  </div>
</body>
</html>`);
};
