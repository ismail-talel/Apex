// src/services/KonnectService.js
// Passerelle de paiement tunisienne : https://konnect.network
const axios = require('axios');
const { BadRequestError } = require('../utils/errors');

const SANDBOX_BASE = 'https://api.preprod.konnect.network/api/v2';
const PRODUCTION_BASE = 'https://api.konnect.network/api/v2';

class KonnectService {
  constructor() {
    this.apiKey = process.env.KONNECT_API_KEY || '';
    this.walletId = process.env.KONNECT_WALLET_ID || '';
    this.sandbox = process.env.KONNECT_SANDBOX !== 'false';
    this.mockMode = process.env.KONNECT_MOCK === 'true' || !this.apiKey || !this.walletId;
    this.baseUrl = this.sandbox ? SANDBOX_BASE : PRODUCTION_BASE;
    this.backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';
  }

  isConfigured() {
    return !this.mockMode;
  }

  /** Convertit un montant en dinars (DT) en millimes Konnect (1 DT = 1000 millimes). */
  toMillimes(amountTnd) {
    return Math.round(Number(amountTnd) * 1000);
  }

  /** Convertit des millimes Konnect en dinars. */
  toTnd(millimes) {
    return Number(millimes) / 1000;
  }

  /**
   * Initie un paiement carte bancaire via Konnect.
   * @returns {{ payUrl: string, paymentRef: string, mock: boolean }}
   */
  async initiateCardPayment({
    amountTnd,
    orderId,
    description,
    email,
    firstName,
    lastName,
    phoneNumber,
    reservationId,
    mockQuery = {},
    successUrl: successUrlOverride,
    failUrl: failUrlOverride
  }) {
    const amount = this.toMillimes(amountTnd);
    if (amount < 100) {
      throw new BadRequestError('Le montant minimum de paiement est de 0,100 DT.');
    }

    if (this.mockMode) {
      const paymentRef = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const query = new URLSearchParams({
        payment_ref: paymentRef,
        reservationId: reservationId || '',
        ...mockQuery
      });
      const payUrl = `${this.backendUrl}/api/payments/konnect/mock-pay?${query.toString()}`;
      console.warn('⚠️  Konnect en mode MOCK — configurez KONNECT_API_KEY et KONNECT_WALLET_ID pour la production.');
      return { payUrl, paymentRef, mock: true };
    }

    const successUrl = successUrlOverride || `${this.frontendUrl}/client?section=reservations&payment=success&reservationId=${reservationId}`;
    const failUrl = failUrlOverride || `${this.frontendUrl}/client?section=reservations&payment=failed&reservationId=${reservationId}`;
    const webhook = `${this.backendUrl}/api/payments/konnect/webhook`;

    const payload = {
      receiverWalletId: this.walletId,
      token: 'TND',
      amount,
      type: 'immediate',
      description: description || `Réservation Apex #${orderId}`,
      acceptedPaymentMethods: ['bank_card'],
      lifespan: 15,
      checkoutForm: false,
      addPaymentFeesToAmount: false,
      email,
      firstName,
      lastName,
      phoneNumber,
      orderId: String(orderId),
      webhook,
      silentWebhook: true,
      successUrl,
      failUrl,
      theme: 'dark'
    };

    try {
      const { data } = await axios.post(`${this.baseUrl}/payments/init-payment`, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (!data?.payUrl || !data?.paymentRef) {
        throw new BadRequestError('Réponse Konnect invalide lors de l\'initialisation du paiement.');
      }

      return { payUrl: data.payUrl, paymentRef: data.paymentRef, mock: false };
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || err.message;
      throw new BadRequestError(`Erreur Konnect : ${msg}`);
    }
  }

  /**
   * Récupère le statut d'un paiement Konnect.
   * @returns {{ status: string, amount: number, reachedAmount: number }}
   */
  async getPaymentStatus(paymentRef) {
    if (this.mockMode && String(paymentRef).startsWith('MOCK-')) {
      return { status: 'completed', amount: 0, reachedAmount: 0, mock: true };
    }

    try {
      const { data } = await axios.get(`${this.baseUrl}/payments/${paymentRef}`, {
        headers: { 'x-api-key': this.apiKey },
        timeout: 15000
      });

      const payment = data?.payment || data;
      return {
        status: payment?.status || 'pending',
        amount: payment?.amount || 0,
        reachedAmount: payment?.reachedAmount || 0,
        mock: false
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      throw new BadRequestError(`Impossible de vérifier le paiement Konnect : ${msg}`);
    }
  }

  isPaymentCompleted(statusResult, expectedAmountTnd) {
    if (statusResult.mock) return true;
    if (statusResult.status !== 'completed') return false;

    const expectedMillimes = this.toMillimes(expectedAmountTnd);
    const reached = statusResult.reachedAmount || statusResult.amount || 0;
    return reached >= expectedMillimes;
  }
}

module.exports = new KonnectService();
