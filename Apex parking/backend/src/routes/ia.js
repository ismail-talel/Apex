// src/routes/ia.js
const express = require('express');
const router = express.Router();
const { chat, healthCheck, getLocations } = require('../controllers/iaController');

const rateLimitMap = new Map();
const RATE_WINDOW_MS = parseInt(process.env.IA_RATE_WINDOW_MS || '60000', 10);
const RATE_MAX_REQUESTS = parseInt(process.env.IA_RATE_MAX || '25', 10);

function iaRateLimit(req, res, next) {
  const key = req.body?.userId || req.ip || 'anonymous';
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
  }

  entry.count += 1;
  rateLimitMap.set(key, entry);

  if (entry.count > RATE_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      reply: '⚠️ Trop de requêtes. Patientez une minute avant de réessayer.'
    });
  }

  next();
}

// Route publique – Health check IA
router.get('/health', healthCheck);

// Route publique – Liste des lieux supportés (Tunisie)
router.get('/locations', getLocations);

// Route publique – Chat avec l'agent IA Mistral
router.post('/chat', iaRateLimit, chat);

module.exports = router;
