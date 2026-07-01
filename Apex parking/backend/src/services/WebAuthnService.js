const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const User = require('../models/User');
const WebAuthnCredential = require('../models/WebAuthnCredential');
const WebAuthnChallenge = require('../models/WebAuthnChallenge');
const authService = require('./AuthService');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../utils/errors');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getRpConfig() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';
  const origin = process.env.WEBAUTHN_ORIGIN || frontendUrl;
  let rpID = process.env.WEBAUTHN_RP_ID;
  if (!rpID) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      rpID = 'localhost';
    }
  }
  return {
    rpName: process.env.WEBAUTHN_RP_NAME || 'Apex Parking',
    rpID,
    origin
  };
}

class WebAuthnService {
  async getRegistrationOptions(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable.');
    }

    const existingCredentials = await WebAuthnCredential.find({ userId });
    const { rpName, rpID } = getRpConfig();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: Buffer.from(user._id.toString()),
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialID,
        transports: cred.transports
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      }
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      userId: user._id,
      type: 'registration',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    });

    return options;
  }

  async verifyRegistration(userId, response, friendlyName) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable.');
    }

    const storedChallenge = await WebAuthnChallenge.findOne({
      userId,
      type: 'registration',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!storedChallenge) {
      throw new BadRequestError('Challenge expiré ou introuvable.');
    }

    const { origin, rpID } = getRpConfig();

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false
      });
    } catch (err) {
      throw new BadRequestError(`Vérification WebAuthn échouée : ${err.message}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestError('Enregistrement de la passkey refusé.');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await WebAuthnCredential.create({
      userId: user._id,
      credentialID: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: response.response.transports || [],
      friendlyName: friendlyName || 'Passkey'
    });

    user.webauthnEnabled = true;
    await user.save();
    await WebAuthnChallenge.deleteMany({ userId, type: 'registration' });

    return { message: 'Passkey enregistrée avec succès.', webauthnEnabled: true };
  }

  async getAuthenticationOptions(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('Aucune passkey associée à cet email.');
    }

    const credentials = await WebAuthnCredential.find({ userId: user._id });
    if (!credentials.length) {
      throw new UnauthorizedError('Aucune passkey enregistrée pour ce compte.');
    }

    const { rpID } = getRpConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((cred) => ({
        id: cred.credentialID,
        transports: cred.transports
      })),
      userVerification: 'preferred'
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      email: normalizedEmail,
      type: 'authentication',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    });

    return options;
  }

  async verifyAuthentication(email, response) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('Authentification refusée.');
    }

    const storedChallenge = await WebAuthnChallenge.findOne({
      email: normalizedEmail,
      type: 'authentication',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!storedChallenge) {
      throw new BadRequestError('Challenge expiré ou introuvable.');
    }

    const credential = await WebAuthnCredential.findOne({
      userId: user._id,
      credentialID: response.id
    });

    if (!credential) {
      throw new UnauthorizedError('Passkey inconnue.');
    }

    const { origin, rpID } = getRpConfig();

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialID,
          publicKey: Buffer.from(credential.publicKey, 'base64url'),
          counter: credential.counter,
          transports: credential.transports
        },
        requireUserVerification: false
      });
    } catch (err) {
      throw new BadRequestError(`Vérification WebAuthn échouée : ${err.message}`);
    }

    if (!verification.verified) {
      throw new UnauthorizedError('Authentification refusée.');
    }

    credential.counter = verification.authenticationInfo.newCounter;
    await credential.save();

    user.lastLogin = new Date();
    await user.save();
    await WebAuthnChallenge.deleteMany({ email: normalizedEmail, type: 'authentication' });

    return authService.issueSession(user);
  }

  async listCredentials(userId) {
    return WebAuthnCredential.find({ userId }).select('friendlyName deviceType backedUp createdAt');
  }

  async deleteCredential(userId, credentialId) {
    const result = await WebAuthnCredential.findOneAndDelete({
      _id: credentialId,
      userId
    });
    if (!result) {
      throw new NotFoundError('Passkey introuvable.');
    }

    const remaining = await WebAuthnCredential.countDocuments({ userId });
    if (remaining === 0) {
      await User.findByIdAndUpdate(userId, { webauthnEnabled: false });
    }

    return { message: 'Passkey supprimée.' };
  }
}

module.exports = new WebAuthnService();
