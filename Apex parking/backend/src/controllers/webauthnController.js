const webauthnService = require('../services/WebAuthnService');

exports.getRegistrationOptions = async (req, res, next) => {
  try {
    const options = await webauthnService.getRegistrationOptions(req.user._id);
    res.json(options);
  } catch (err) {
    next(err);
  }
};

exports.verifyRegistration = async (req, res, next) => {
  try {
    const result = await webauthnService.verifyRegistration(
      req.user._id,
      req.body,
      req.body.friendlyName
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAuthenticationOptions = async (req, res, next) => {
  try {
    const options = await webauthnService.getAuthenticationOptions(req.body.email);
    res.json(options);
  } catch (err) {
    next(err);
  }
};

exports.verifyAuthentication = async (req, res, next) => {
  try {
    const { email, ...response } = req.body;
    const result = await webauthnService.verifyAuthentication(email, response);
    res.json({
      message: 'Connexion par passkey réussie.',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.listCredentials = async (req, res, next) => {
  try {
    const credentials = await webauthnService.listCredentials(req.user._id);
    res.json({ credentials });
  } catch (err) {
    next(err);
  }
};

exports.deleteCredential = async (req, res, next) => {
  try {
    const result = await webauthnService.deleteCredential(req.user._id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
