const rekognitionService = require('../services/RekognitionService');

exports.enrollFace = async (req, res, next) => {
  try {
    const result = await rekognitionService.enrollFace(req.user._id, req.body.image);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.verifyFace = async (req, res, next) => {
  try {
    const result = await rekognitionService.verifyFace(req.body.image);
    res.json({
      message: 'Connexion par reconnaissance faciale réussie.',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.removeFaceEnrollment = async (req, res, next) => {
  try {
    const result = await rekognitionService.removeFaceEnrollment(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    res.json(rekognitionService.getStatus());
  } catch (err) {
    next(err);
  }
};
