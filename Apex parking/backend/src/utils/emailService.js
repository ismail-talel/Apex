const MockEmail = require('../models/MockEmail');

/**
 * Envoie un email simulé et l'enregistre en base de données pour la boîte mail virtuelle
 * @param {string} to - Destinataire
 * @param {string} subject - Sujet du mail
 * @param {string} body - Contenu HTML
 */
exports.sendEmail = async (to, subject, body) => {
  try {
    // Créer et enregistrer le mail fictif dans la base de données
    const mockEmail = new MockEmail({
      to,
      subject,
      body
    });
    await mockEmail.save();

    console.log('\n==================================================');
    console.log(`📧 [MOCK EMAIL SENT]`);
    console.log(`À      : ${to}`);
    console.log(`Sujet  : ${subject}`);
    console.log(`Contenu: ${body.replace(/<[^>]*>/g, ' ').substring(0, 150)}...`);
    console.log('==================================================\n');

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email simulé:', error);
    return false;
  }
};
