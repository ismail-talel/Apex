const Complaint = require('../models/Complaint');
const Parking = require('../models/Parking');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const UserRoles = require('../models/UserRoles');
const { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } = require('../utils/errors');
const { sendEmail } = require('../utils/emailService');

class ComplaintService {
  _requireAuth(user) {
    if (!user) throw new UnauthorizedError('Authentification requise.');
  }

  _requireRoles(user, ...roles) {
    this._requireAuth(user);
    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Accès refusé. Rôle insuffisant.');
    }
  }

  async _verifyParkingAccess(parkingId, user) {
    this._requireAuth(user);
    if (user.role === UserRoles.SUPER_ADMIN) return;

    const parking = await Parking.findById(parkingId);
    if (!parking) throw new NotFoundError('Parking non trouvé.');

    if (user.role === UserRoles.COMPANY) {
      if (parking.companyId.toString() !== user._id.toString()) {
        throw new ForbiddenError('Ce parking ne vous appartient pas.');
      }
      return;
    }

    if (user.role === UserRoles.EMPLOYEE) {
      if (!user.parkingId || user.parkingId.toString() !== parkingId.toString()) {
        throw new ForbiddenError('Vous n\'êtes pas assigné à ce parking.');
      }
      return;
    }

    throw new ForbiddenError('Accès refusé.');
  }

  async _getComplaintOrThrow(id) {
    const complaint = await Complaint.findById(id)
      .populate('clientId', 'name email phone')
      .populate('parkingId', 'name address city')
      .populate('companyId', 'name email companyName')
      .populate('reservationId', 'spotNumber vehiclePlate status')
      .populate('respondedBy', 'name role')
      .populate('resolvedBy', 'name role');

    if (!complaint) throw new NotFoundError('Réclamation introuvable.');
    return complaint;
  }

  _canView(complaint, user) {
    this._requireAuth(user);
    if (user.role === UserRoles.SUPER_ADMIN) return;
    if (complaint.clientId._id?.toString() === user._id.toString() || complaint.clientId.toString() === user._id.toString()) return;
    if (user.role === UserRoles.COMPANY && complaint.companyId._id?.toString() === user._id.toString()) return;
    if (user.role === UserRoles.EMPLOYEE && user.parkingId?.toString() === complaint.parkingId._id?.toString()) return;
    throw new ForbiddenError('Accès refusé à cette réclamation.');
  }

  async createComplaint(data, currentUser) {
    this._requireRoles(currentUser, UserRoles.CLIENT);

    const { parkingId, reservationId, subscriptionId, subject, category, description, priority } = data;

    const parking = await Parking.findById(parkingId);
    if (!parking || parking.isDeleted || parking.status !== 'approved') {
      throw new BadRequestError('Parking invalide ou non disponible.');
    }

    if (reservationId) {
      const reservation = await Reservation.findById(reservationId);
      if (!reservation || reservation.clientId.toString() !== currentUser._id.toString()) {
        throw new BadRequestError('Réservation invalide pour cette réclamation.');
      }
      if (reservation.parkingId.toString() !== parkingId.toString()) {
        throw new BadRequestError('La réservation ne correspond pas au parking sélectionné.');
      }
    }

    const complaint = await Complaint.create({
      clientId: currentUser._id,
      parkingId: parking._id,
      companyId: parking.companyId,
      reservationId: reservationId || null,
      subscriptionId: subscriptionId || null,
      subject,
      category: category || 'other',
      description,
      priority: priority || 'medium',
      status: 'pending'
    });

    const populated = await this._getComplaintOrThrow(complaint._id);
    const company = await User.findById(parking.companyId);
    if (company?.email) {
      await sendEmail(
        company.email,
        `Nouvelle réclamation — ${subject}`,
        `<p>Le client <strong>${currentUser.name}</strong> a déposé une réclamation concernant <strong>${parking.name}</strong>.</p><p><strong>Sujet :</strong> ${subject}</p><p>Connectez-vous à votre espace entreprise pour y répondre.</p>`
      );
    }

    return { success: true, message: 'Réclamation enregistrée avec succès.', data: populated };
  }

  async getMyComplaints(currentUser) {
    this._requireRoles(currentUser, UserRoles.CLIENT);
    const complaints = await Complaint.find({ clientId: currentUser._id })
      .populate('parkingId', 'name city')
      .populate('reservationId', 'spotNumber status')
      .sort({ createdAt: -1 });
    return { success: true, data: complaints };
  }

  async getCompanyComplaints(currentUser, query = {}) {
    this._requireRoles(currentUser, UserRoles.COMPANY);
    const filter = { companyId: currentUser._id };
    if (query.status) filter.status = query.status;
    const complaints = await Complaint.find(filter)
      .populate('clientId', 'name email phone')
      .populate('parkingId', 'name city')
      .populate('reservationId', 'spotNumber status')
      .sort({ createdAt: -1 });
    return { success: true, data: complaints };
  }

  async getParkingComplaints(parkingId, currentUser, query = {}) {
    await this._verifyParkingAccess(parkingId, currentUser);
    const filter = { parkingId };
    if (query.status) filter.status = query.status;
    const complaints = await Complaint.find(filter)
      .populate('clientId', 'name email phone')
      .populate('parkingId', 'name city')
      .populate('reservationId', 'spotNumber status')
      .sort({ createdAt: -1 });
    return { success: true, data: complaints };
  }

  async getAllComplaints(currentUser, query = {}) {
    this._requireRoles(currentUser, UserRoles.SUPER_ADMIN);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    const complaints = await Complaint.find(filter)
      .populate('clientId', 'name email')
      .populate('parkingId', 'name city')
      .populate('companyId', 'name companyName email')
      .sort({ createdAt: -1 });
    return { success: true, data: complaints };
  }

  async getComplaintById(id, currentUser) {
    const complaint = await this._getComplaintOrThrow(id);
    this._canView(complaint, currentUser);
    return { success: true, data: complaint };
  }

  async respondToComplaint(id, note, currentUser) {
    this._requireRoles(currentUser, UserRoles.EMPLOYEE, UserRoles.COMPANY);
    const complaint = await this._getComplaintOrThrow(id);
    await this._verifyParkingAccess(complaint.parkingId._id || complaint.parkingId, currentUser);

    if (!['pending', 'in_progress', 'escalated'].includes(complaint.status)) {
      throw new BadRequestError('Cette réclamation ne peut plus recevoir de réponse.');
    }

    complaint.responseNote = note;
    complaint.respondedBy = currentUser._id;
    complaint.respondedAt = new Date();
    complaint.status = 'in_progress';
    await complaint.save();

    const client = await User.findById(complaint.clientId._id || complaint.clientId);
    if (client?.email) {
      await sendEmail(
        client.email,
        `Réponse à votre réclamation ${complaint.reference}`,
        `<p>L'entreprise a répondu à votre réclamation <strong>${complaint.subject}</strong> :</p><p>${note}</p>`
      );
    }

    return { success: true, message: 'Réponse envoyée au client.', data: await this._getComplaintOrThrow(id) };
  }

  async resolveComplaint(id, note, currentUser) {
    this._requireRoles(currentUser, UserRoles.EMPLOYEE, UserRoles.COMPANY, UserRoles.SUPER_ADMIN);
    const complaint = await this._getComplaintOrThrow(id);

    if (currentUser.role !== UserRoles.SUPER_ADMIN) {
      await this._verifyParkingAccess(complaint.parkingId._id || complaint.parkingId, currentUser);
    }

    if (!['pending', 'in_progress', 'escalated'].includes(complaint.status)) {
      throw new BadRequestError('Cette réclamation est déjà clôturée.');
    }

    complaint.resolutionNote = note;
    complaint.resolvedBy = currentUser._id;
    complaint.resolvedAt = new Date();
    complaint.status = 'resolved';
    await complaint.save();

    const client = await User.findById(complaint.clientId._id || complaint.clientId);
    if (client?.email) {
      await sendEmail(
        client.email,
        `Réclamation résolue — ${complaint.reference}`,
        `<p>Votre réclamation <strong>${complaint.subject}</strong> a été marquée comme résolue.</p><p>${note}</p>`
      );
    }

    return { success: true, message: 'Réclamation résolue.', data: await this._getComplaintOrThrow(id) };
  }

  async escalateComplaint(id, currentUser) {
    const complaint = await this._getComplaintOrThrow(id);

    const isClient = currentUser.role === UserRoles.CLIENT
      && (complaint.clientId._id?.toString() === currentUser._id.toString() || complaint.clientId.toString() === currentUser._id.toString());
    const isCompany = currentUser.role === UserRoles.COMPANY
      && complaint.companyId._id?.toString() === currentUser._id.toString();

    if (!isClient && !isCompany) {
      throw new ForbiddenError('Vous ne pouvez pas escalader cette réclamation.');
    }

    if (!['pending', 'in_progress'].includes(complaint.status)) {
      throw new BadRequestError('Cette réclamation ne peut pas être escaladée.');
    }

    complaint.status = 'escalated';
    complaint.escalatedAt = new Date();
    await complaint.save();

    const admins = await User.find({ role: UserRoles.SUPER_ADMIN }).select('email');
    for (const admin of admins) {
      if (admin.email) {
        await sendEmail(
          admin.email,
          `Réclamation escaladée — ${complaint.reference}`,
          `<p>La réclamation <strong>${complaint.subject}</strong> a été escaladée et nécessite une intervention administrateur.</p>`
        );
      }
    }

    return { success: true, message: 'Réclamation escaladée vers l\'administrateur.', data: await this._getComplaintOrThrow(id) };
  }

  async rejectComplaint(id, reason, currentUser) {
    this._requireRoles(currentUser, UserRoles.COMPANY, UserRoles.SUPER_ADMIN);
    const complaint = await this._getComplaintOrThrow(id);

    if (currentUser.role === UserRoles.COMPANY) {
      if (complaint.companyId._id?.toString() !== currentUser._id.toString()) {
        throw new ForbiddenError('Cette réclamation ne concerne pas votre entreprise.');
      }
    }

    if (!['pending', 'in_progress', 'escalated'].includes(complaint.status)) {
      throw new BadRequestError('Cette réclamation ne peut plus être rejetée.');
    }

    complaint.rejectReason = reason;
    complaint.status = 'rejected';
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = currentUser._id;
    await complaint.save();

    const client = await User.findById(complaint.clientId._id || complaint.clientId);
    if (client?.email) {
      await sendEmail(
        client.email,
        `Réclamation rejetée — ${complaint.reference}`,
        `<p>Votre réclamation <strong>${complaint.subject}</strong> a été rejetée.</p><p><strong>Motif :</strong> ${reason}</p>`
      );
    }

    return { success: true, message: 'Réclamation rejetée.', data: await this._getComplaintOrThrow(id) };
  }

  async closeComplaint(id, currentUser) {
    const complaint = await this._getComplaintOrThrow(id);
    const isClient = currentUser.role === UserRoles.CLIENT
      && (complaint.clientId._id?.toString() === currentUser._id.toString() || complaint.clientId.toString() === currentUser._id.toString());

    if (!isClient && currentUser.role !== UserRoles.SUPER_ADMIN) {
      throw new ForbiddenError('Seul le client ou l\'administrateur peut clôturer cette réclamation.');
    }

    if (complaint.status !== 'resolved') {
      throw new BadRequestError('Seules les réclamations résolues peuvent être clôturées.');
    }

    complaint.status = 'closed';
    await complaint.save();
    return { success: true, message: 'Réclamation clôturée.', data: await this._getComplaintOrThrow(id) };
  }
}

module.exports = new ComplaintService();
