const crypto = require('crypto');
const sharp = require('sharp');
const {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  DetectFacesCommand
} = require('@aws-sdk/client-rekognition');
const User = require('../models/User');
const authService = require('./AuthService');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../utils/errors');

class RekognitionService {
  constructor() {
    this.mockMode = process.env.REKOGNITION_MOCK === 'true'
      || !process.env.AWS_ACCESS_KEY_ID
      || !process.env.AWS_SECRET_ACCESS_KEY;

    if (!this.mockMode) {
      this.client = new RekognitionClient({
        region: process.env.AWS_REGION || 'eu-west-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      this.collectionId = process.env.REKOGNITION_COLLECTION_ID || 'apex-users-faces';
      this.matchThreshold = Number(process.env.FACE_MATCH_THRESHOLD || 90);
      this.collectionReady = false;
    } else {
      console.log('⚠️  Rekognition en mode MOCK (REKOGNITION_MOCK=true ou credentials AWS absents)');
    }
  }

  _decodeImage(imageBase64) {
    const base64Data = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    if (!base64Data) {
      throw new BadRequestError('Image requise (base64).');
    }
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 1000) {
      throw new BadRequestError('Image trop petite ou invalide.');
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestError('Image trop volumineuse (max 5 Mo).');
    }
    return buffer;
  }

  _mockFaceHash(imageBuffer) {
    return crypto.createHash('sha256').update(imageBuffer).digest('hex');
  }

  async _mockFaceSignature(imageBuffer) {
    const { data } = await sharp(imageBuffer)
      .resize(48, 48, { fit: 'cover' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return Array.from(data);
  }

  _mockDistance(signatureA, signatureB) {
    if (!signatureA?.length || !signatureB?.length || signatureA.length !== signatureB.length) {
      return Number.POSITIVE_INFINITY;
    }
    let total = 0;
    for (let i = 0; i < signatureA.length; i++) {
      total += Math.abs(signatureA[i] - signatureB[i]);
    }
    return total / signatureA.length;
  }

  async _matchMockFace(imageBuffer) {
    const signature = await this._mockFaceSignature(imageBuffer);
    const candidates = await User.find({
      'faceAuth.enabled': true,
      'faceAuth.mockMode': true,
      'faceAuth.faceSignature.0': { $exists: true }
    }).select('+faceAuth.faceSignature');

    if (!candidates.length) {
      throw new BadRequestError(
        'Aucun visage enregistré. Connectez-vous par mot de passe, puis enregistrez votre visage dans Mon Profil.'
      );
    }

    let bestUser = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const distance = this._mockDistance(signature, candidate.faceAuth.faceSignature);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestUser = candidate;
      }
    }

    const threshold = Number(process.env.MOCK_FACE_MATCH_THRESHOLD || 40);
    if (!bestUser || bestDistance > threshold) {
      throw new UnauthorizedError(
        `Visage non reconnu. Réenregistrez votre visage dans le profil (éclairage stable, même position).`
      );
    }

    return bestUser;
  }

  async _ensureCollection() {
    if (this.mockMode || this.collectionReady) return;
    try {
      await this.client.send(new CreateCollectionCommand({
        CollectionId: this.collectionId
      }));
    } catch (err) {
      if (err.name !== 'ResourceAlreadyExistsException') {
        throw err;
      }
    }
    this.collectionReady = true;
  }

  async _validateSingleFace(imageBuffer) {
    if (this.mockMode) return;

    const result = await this.client.send(new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['DEFAULT']
    }));

    const faces = result.FaceDetails || [];
    if (faces.length === 0) {
      throw new BadRequestError('Aucun visage détecté. Positionnez-vous face à la caméra.');
    }
    if (faces.length > 1) {
      throw new BadRequestError('Plusieurs visages détectés. Un seul visage est autorisé.');
    }
  }

  async enrollFace(userId, imageBase64) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable.');
    }

    const imageBuffer = this._decodeImage(imageBase64);
    await this._validateSingleFace(imageBuffer);

    if (this.mockMode) {
      const faceSignature = await this._mockFaceSignature(imageBuffer);
      const faceHash = this._mockFaceHash(imageBuffer);
      user.faceAuth = {
        enabled: true,
        rekognitionFaceId: `mock-${faceHash.slice(0, 16)}`,
        faceHash,
        faceSignature,
        enrolledAt: new Date(),
        mockMode: true
      };
      await user.save();
      return {
        message: 'Reconnaissance faciale activée (mode développement).',
        faceAuthEnabled: true,
        mockMode: true
      };
    }

    await this._ensureCollection();

    if (user.faceAuth?.rekognitionFaceId) {
      try {
        await this.client.send(new DeleteFacesCommand({
          CollectionId: this.collectionId,
          FaceIds: [user.faceAuth.rekognitionFaceId]
        }));
      } catch {
        // Ignorer si le visage n'existe plus côté AWS
      }
    }

    const indexResult = await this.client.send(new IndexFacesCommand({
      CollectionId: this.collectionId,
      Image: { Bytes: imageBuffer },
      ExternalImageId: user._id.toString(),
      DetectionAttributes: ['DEFAULT'],
      MaxFaces: 1,
      QualityFilter: 'AUTO'
    }));

    const faceRecord = indexResult.FaceRecords?.[0];
    if (!faceRecord?.Face?.FaceId) {
      throw new BadRequestError('Impossible d\'indexer le visage. Réessayez avec un meilleur éclairage.');
    }

    user.faceAuth = {
      enabled: true,
      rekognitionFaceId: faceRecord.Face.FaceId,
      enrolledAt: new Date(),
      mockMode: false
    };
    await user.save();

    return {
      message: 'Reconnaissance faciale activée avec succès.',
      faceAuthEnabled: true,
      mockMode: false
    };
  }

  async verifyFace(imageBase64) {
    const imageBuffer = this._decodeImage(imageBase64);
    await this._validateSingleFace(imageBuffer);

    if (this.mockMode) {
      const user = await this._matchMockFace(imageBuffer);
      user.lastLogin = new Date();
      await user.save();
      return authService.issueSession(user);
    }

    await this._ensureCollection();

    const searchResult = await this.client.send(new SearchFacesByImageCommand({
      CollectionId: this.collectionId,
      Image: { Bytes: imageBuffer },
      FaceMatchThreshold: this.matchThreshold,
      MaxFaces: 1
    }));

    const match = searchResult.FaceMatches?.[0];
    if (!match?.Face?.FaceId) {
      throw new UnauthorizedError('Visage non reconnu.');
    }

    const user = await User.findOne({
      'faceAuth.enabled': true,
      'faceAuth.rekognitionFaceId': match.Face.FaceId
    });

    if (!user) {
      throw new UnauthorizedError('Visage non associé à un compte actif.');
    }

    user.lastLogin = new Date();
    await user.save();
    return authService.issueSession(user);
  }

  async removeFaceEnrollment(userId) {
    const user = await User.findById(userId);
    if (!user?.faceAuth?.enabled) {
      throw new NotFoundError('Aucune reconnaissance faciale enregistrée.');
    }

    if (!this.mockMode && user.faceAuth.rekognitionFaceId) {
      try {
        await this._ensureCollection();
        await this.client.send(new DeleteFacesCommand({
          CollectionId: this.collectionId,
          FaceIds: [user.faceAuth.rekognitionFaceId]
        }));
      } catch {
        // Continuer même si AWS échoue
      }
    }

    user.faceAuth = {
      enabled: false,
      rekognitionFaceId: null,
      faceHash: null,
      faceSignature: null,
      enrolledAt: null,
      mockMode: false
    };
    await user.save();

    return { message: 'Reconnaissance faciale désactivée.' };
  }

  getStatus() {
    return {
      mockMode: this.mockMode,
      collectionId: this.mockMode ? null : this.collectionId,
      matchThreshold: this.mockMode ? null : this.matchThreshold
    };
  }
}

module.exports = new RekognitionService();
