const { validationResult } = require('express-validator');
const complaintService = require('../services/ComplaintService');

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0]?.msg || 'Données invalides.',
      errors: errors.array()
    });
    return true;
  }
  return false;
};

exports.createComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.createComplaint(req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getMyComplaints = async (req, res, next) => {
  try {
    const result = await complaintService.getMyComplaints(req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getCompanyComplaints = async (req, res, next) => {
  try {
    const result = await complaintService.getCompanyComplaints(req.user, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getParkingComplaints = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.getParkingComplaints(req.params.parkingId, req.user, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllComplaints = async (req, res, next) => {
  try {
    const result = await complaintService.getAllComplaints(req.user, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getComplaintById = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.getComplaintById(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.respondToComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.respondToComplaint(req.params.id, req.body.note, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.resolveComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.resolveComplaint(req.params.id, req.body.note, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.escalateComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.escalateComplaint(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.rejectComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.rejectComplaint(req.params.id, req.body.reason, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.closeComplaint = async (req, res, next) => {
  try {
    if (handleValidation(req, res)) return;
    const result = await complaintService.closeComplaint(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
