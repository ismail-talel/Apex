const { validationResult } = require('express-validator');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Parking = require('../models/Parking');
const User = require('../models/User');
const konnectService = require('../services/KonnectService');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

function toAbsolutePayUrl(payUrl) {
  if (!payUrl) return payUrl;
  if (payUrl.startsWith('http')) return payUrl;
  const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base}${payUrl.startsWith('/') ? payUrl : `/${payUrl}`}`;
}

async function activateSubscription(subscription, paymentRef) {
  const plan = subscription.planId;
  if (!plan) {
    throw new NotFoundError('Forfait associé introuvable.');
  }

  const existingActive = await Subscription.findOne({
    clientId: subscription.clientId,
    parkingId: subscription.parkingId,
    status: 'active',
    endDate: { $gt: new Date() },
    _id: { $ne: subscription._id }
  }).sort({ endDate: -1 });

  let startDate = new Date();
  if (existingActive) {
    startDate = new Date(existingActive.endDate);
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.durationDays);

  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.status = 'active';
  subscription.konnectPaymentRef = paymentRef;
  subscription.paymentMethod = 'card';
  await subscription.save();

  return subscription;
}

// ==================== COMPANY ACTIONS ====================

exports.createPlan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, parkingId, price, durationDays, features } = req.body;

    const parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({ message: 'Parking non trouvé.' });
    }

    if (parking.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès interdit. Ce parking ne vous appartient pas.' });
    }

    const plan = new SubscriptionPlan({
      name,
      description,
      parkingId,
      companyId: req.user._id,
      price,
      durationDays,
      features: features || []
    });

    await plan.save();
    res.status(201).json({ message: 'Plan d\'abonnement créé avec succès.', plan });
  } catch (error) {
    next(error);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, durationDays, features, isActive } = req.body;
    const plan = await SubscriptionPlan.findById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ message: 'Plan d\'abonnement non trouvé.' });
    }

    if (plan.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès interdit.' });
    }

    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = price;
    if (durationDays !== undefined) plan.durationDays = durationDays;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();
    res.json({ message: 'Plan d\'abonnement mis à jour.', plan });
  } catch (error) {
    next(error);
  }
};

exports.getCompanySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({
      parkingId: { $in: await Parking.find({ companyId: req.user._id }).select('_id') }
    })
      .populate('planId')
      .populate('parkingId')
      .populate('clientId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

// ==================== CLIENT ACTIONS ====================

exports.getPlansForParking = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({
      parkingId: req.params.parkingId,
      isActive: true
    });
    res.json({ plans });
  } catch (error) {
    next(error);
  }
};

exports.buySubscription = async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;

    const plan = await SubscriptionPlan.findById(planId).populate('parkingId', 'name');
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: 'Plan d\'abonnement non trouvé ou inactif.' });
    }

    const existingPending = await Subscription.findOne({
      clientId: req.user._id,
      planId: plan._id,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(201).json({
        message: 'Abonnement en attente de paiement.',
        subscription: existingPending
      });
    }

    const subscription = new Subscription({
      clientId: req.user._id,
      planId: plan._id,
      parkingId: plan.parkingId,
      startDate: new Date(),
      endDate: new Date(),
      pricePaid: plan.price,
      paymentMethod: paymentMethod || 'card',
      status: 'pending'
    });
    await subscription.save();

    await subscription.populate('planId').populate('parkingId', 'name address city');

    res.status(201).json({
      message: 'Abonnement créé. Procédez au paiement Konnect pour l\'activer.',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

exports.confirmSubscriptionPayment = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('planId')
      .populate('parkingId', 'name');

    if (!subscription) {
      throw new NotFoundError('Abonnement introuvable.');
    }

    if (subscription.clientId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('Accès refusé.');
    }

    if (subscription.status === 'active') {
      return res.json({
        success: true,
        message: 'Abonnement déjà actif.',
        data: { subscription }
      });
    }

    if (subscription.status !== 'pending') {
      throw new BadRequestError(`Impossible de payer un abonnement en statut "${subscription.status}".`);
    }

    const plan = subscription.planId;
    if (!plan) {
      throw new NotFoundError('Forfait associé introuvable.');
    }

    const client = await User.findById(req.user._id);
    const nameParts = (client?.name || 'Client').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || 'Apex';

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';
    const subscriptionId = subscription._id.toString();

    const payment = await konnectService.initiateCardPayment({
      amountTnd: subscription.pricePaid,
      orderId: subscription.transactionId,
      description: `Abonnement ${plan.name} — ${subscription.parkingId?.name || 'Apex'}`,
      email: client?.email,
      firstName,
      lastName,
      phoneNumber: client?.phone || '',
      successUrl: `${frontendUrl}/client?section=subscriptions&payment=success&subscriptionId=${subscriptionId}`,
      failUrl: `${frontendUrl}/client?section=subscriptions&payment=failed&subscriptionId=${subscriptionId}`,
      mockQuery: { subscriptionId }
    });

    subscription.konnectPaymentRef = payment.paymentRef;
    subscription.paymentMethod = 'card';
    await subscription.save();

    res.json({
      success: true,
      message: 'Redirection vers la passerelle de paiement Konnect (carte bancaire).',
      data: {
        subscriptionId: subscription._id,
        payUrl: toAbsolutePayUrl(payment.payUrl),
        paymentRef: payment.paymentRef,
        mock: payment.mock,
        provider: 'konnect'
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.verifySubscriptionPayment = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('planId')
      .populate('parkingId');

    if (!subscription) {
      throw new NotFoundError('Abonnement introuvable.');
    }

    if (subscription.clientId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('Accès refusé.');
    }

    if (subscription.status === 'active') {
      return res.json({ message: 'Abonnement déjà actif.', subscription });
    }

    if (subscription.status !== 'pending') {
      throw new BadRequestError('Cet abonnement ne peut plus être payé.');
    }

    const paymentRef = req.query.payment_ref || subscription.konnectPaymentRef;
    if (!paymentRef) {
      throw new BadRequestError('Référence de paiement manquante.');
    }

    const statusResult = await konnectService.getPaymentStatus(paymentRef);
    if (!konnectService.isPaymentCompleted(statusResult, subscription.pricePaid)) {
      throw new BadRequestError('Le paiement n\'a pas été confirmé par Konnect. Réessayez ou contactez votre banque.');
    }

    await activateSubscription(subscription, paymentRef);

    res.json({
      success: true,
      message: 'Abonnement activé avec succès.',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

exports.completeSubscriptionPaymentFromKonnect = async (paymentRef) => {
  const subscription = await Subscription.findOne({ konnectPaymentRef: paymentRef })
    .populate('planId')
    .populate('parkingId');

  if (!subscription) {
    throw new NotFoundError('Aucun abonnement associé à ce paiement.');
  }

  if (subscription.status === 'active') {
    return { success: true, message: 'Déjà activé.', subscriptionId: subscription._id };
  }

  if (subscription.status !== 'pending') {
    throw new BadRequestError(`Impossible de finaliser : statut "${subscription.status}".`);
  }

  const statusResult = await konnectService.getPaymentStatus(paymentRef);
  if (!konnectService.isPaymentCompleted(statusResult, subscription.pricePaid)) {
    throw new BadRequestError('Paiement non confirmé.');
  }

  await activateSubscription(subscription, paymentRef);
  return { success: true, message: 'Abonnement activé.', subscriptionId: subscription._id };
};

exports.getClientSubscriptions = async (req, res, next) => {
  try {
    const now = new Date();
    await Subscription.updateMany(
      { clientId: req.user._id, status: 'active', endDate: { $lt: now } },
      { status: 'expired' }
    );

    const subscriptions = await Subscription.find({ clientId: req.user._id })
      .populate('planId')
      .populate('parkingId')
      .sort({ endDate: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN ACTIONS ====================

exports.getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('planId')
      .populate('parkingId')
      .populate('clientId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};
