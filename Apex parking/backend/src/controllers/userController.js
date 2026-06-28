// src/controllers/userController.js
const { validationResult } = require('express-validator');
const userService = require('../services/UserService');

exports.getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await userService.updateMe(req.user, req.body);
    res.json({ message: 'Profil mis à jour.', user });
  } catch (error) {
    next(error);
  }
};

exports.deleteMe = async (req, res, next) => {
  try {
    const result = await userService.deleteMe(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers(req.user);
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await userService.getUserById(req.params.id, req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await userService.updateUser(req.params.id, req.body, req.user);
    res.json({ message: 'Utilisateur mis à jour.', user });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.createEmployee = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await userService.createEmployee(req.body, req.user);
    res.status(201).json({ message: 'Employé créé avec succès et identifiants envoyés.', user });
  } catch (error) {
    next(error);
  }
};

exports.getCompanyEmployees = async (req, res, next) => {
  try {
    const employees = await userService.getCompanyEmployees(req.query.companyId, req.user);
    res.json({ employees });
  } catch (error) {
    next(error);
  }
};

exports.submitParkingRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const parking = await userService.submitParkingRequest(req.body, req.user);
    res.status(201).json({ message: 'Demande d\'intégration de parking soumise avec succès.', parking });
  } catch (error) {
    next(error);
  }
};

exports.getCompanyParkings = async (req, res, next) => {
  try {
    const parkings = await userService.getCompanyParkings(req.user);
    res.json({ parkings });
  } catch (error) {
    next(error);
  }
};
