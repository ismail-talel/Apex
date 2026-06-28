// src/controllers/authController.js
const { validationResult } = require('express-validator');
const authService = require('../services/AuthService');

// ─── Register ────────────────────────────────────────────────────────────────
exports.registerUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await authService.registerUser(req.body);
    res.status(201).json({
      message: 'Utilisateur créé avec succès.',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────
exports.loginUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.json({
      message: 'Connexion réussie.',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};