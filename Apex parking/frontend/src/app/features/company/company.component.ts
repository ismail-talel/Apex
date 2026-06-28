import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ReservationService } from '../../core/services/reservation.service';
import { ComplaintService } from '../../core/services/complaint.service';

@Component({
  selector: 'app-company',
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.css']
})
export class CompanyComponent implements OnInit {
  activeSection: 'parking' | 'employees' | 'profile' | 'subscriptions' | 'reservations' | 'complaints' = 'parking';
  profile: any = null;
  employees: any[] = [];
  parkings: any[] = [];
  subscribers: any[] = [];
  plans: Record<string, any[]> = {}; // Map of parkingId -> plans[]
  parkingReservations: Record<string, any[]> = {}; // Map of parkingId -> reservations[]
  parkingStats: Record<string, any> = {}; // Map of parkingId -> stats object

  complaints: any[] = [];
  complaintStatusFilter = '';
  selectedComplaint: any = null;
  complaintResponseNote = '';
  complaintResolveNote = '';
  complaintRejectReason = '';
  complaintActionLoading = false;

  // Parking request form
  parkingName = '';
  parkingAddress = '';
  parkingCity = '';
  parkingZip = '';
  parkingSpots: number | null = null;
  parkingPrice: number | null = null;
  parkingSubmitted = false;

  // Employee form
  empName = '';
  empEmail = '';
  empPassword = '';
  empPhone = '';
  empParkingId = '';
  empPosition = 'agent';

  // Subscription Plan form
  planName = '';
  planDescription = '';
  planParkingId = '';
  planPrice: number | null = null;
  planDurationDays: number | null = null;
  planFeaturesInput = '';

  // Profile fields
  profileName = '';
  profilePhone = '';
  profileAddress = '';
  profileSiret = '';
  profilePassword = '';
  profilePasswordConfirm = '';
  profileLoadError: string | null = null;
  profileSaving = false;

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private userService: UserService, 
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private reservationService: ReservationService,
    private complaintService: ComplaintService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadEmployees();
    this.loadParkings();
    this.loadSubscribers();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadProfile(): void {
    this.profileLoadError = null;
    this.userService.getMe().subscribe({
      next: r => {
        this.profile = r.user;
        this.resetProfileForm();
      },
      error: () => {
        this.profileLoadError = 'Impossible de charger votre profil entreprise.';
        this.showToast(this.profileLoadError, 'error');
      }
    });
  }

  resetProfileForm(): void {
    if (!this.profile) return;
    this.profileName = this.profile.name || '';
    this.profilePhone = this.profile.phone || '';
    this.profileAddress = this.profile.address || '';
    this.profileSiret = this.profile.siret || '';
    this.profilePassword = '';
    this.profilePasswordConfirm = '';
  }

  getProfileInitials(): string {
    const name = (this.profileName || this.profile?.name || 'E').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getStatusLabel(status?: string): string {
    const map: Record<string, string> = {
      approved: 'Compte approuvé',
      pending: 'En attente de validation',
      rejected: 'Compte rejeté',
      suspended: 'Compte suspendu'
    };
    return map[status || ''] || status || '—';
  }

  getStatusClass(status?: string): string {
    const map: Record<string, string> = {
      approved: 'badge-approved',
      pending: 'badge-pending',
      rejected: 'badge-rejected',
      suspended: 'badge-suspended'
    };
    return map[status || ''] || 'badge-pending';
  }

  getApprovedParkingsCount(): number {
    return this.getApprovedParkings().length;
  }

  getPendingParkingsCount(): number {
    return this.parkings.filter(p => p.status === 'pending').length;
  }

  getTotalCompanyRevenue(): number {
    return Object.values(this.parkingStats).reduce((sum, stats: any) => sum + (stats?.revenue || 0), 0);
  }

  getTotalReservationsCount(): number {
    return Object.values(this.parkingReservations).reduce((sum, list) => sum + (list?.length || 0), 0);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private getProfileValidationError(): string | null {
    if (!this.profileName.trim()) {
      return 'Le nom de l\'entreprise est obligatoire.';
    }

    const phone = this.normalizePhone(this.profilePhone);
    if (!phone || phone.length < 8 || phone.length > 10) {
      return 'Le téléphone doit contenir entre 8 et 10 chiffres.';
    }

    if (!this.profileAddress.trim()) {
      return 'L\'adresse du siège social est obligatoire.';
    }

    if (this.profileSiret.trim() && !/^\d{14}$/.test(this.profileSiret.replace(/\s/g, ''))) {
      return 'Le numéro SIRET doit contenir 14 chiffres.';
    }

    if (this.profilePassword || this.profilePasswordConfirm) {
      if (this.profilePassword.length < 6) {
        return 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
      }
      if (this.profilePassword !== this.profilePasswordConfirm) {
        return 'Les mots de passe ne correspondent pas.';
      }
    }

    return null;
  }

  loadEmployees(): void {
    this.userService.getEmployees().subscribe({ next: r => this.employees = r.employees || [] });
  }

  loadSubscribers(): void {
    this.subscriptionService.getCompanySubscribers().subscribe({
      next: r => this.subscribers = r.subscriptions || r.subscribers || []
    });
  }

  loadParkings(): void {
    this.userService.getCompanyParkings().subscribe({
      next: r => {
        this.parkings = r.parkings || [];
        // Load plans, reservations, and stats for each approved parking
        this.parkings.forEach(p => {
          if (p.status === 'approved') {
            this.loadPlansForParking(p._id);
            this.loadReservationsForParking(p._id);
            this.loadStatsForParking(p._id);
          }
        });
      }
    });
  }

  loadPlansForParking(parkingId: string): void {
    this.subscriptionService.getPlansForParking(parkingId).subscribe({
      next: r => {
        this.plans[parkingId] = r.plans || [];
      }
    });
  }

  loadReservationsForParking(parkingId: string): void {
    this.reservationService.getParkingReservations(parkingId).subscribe({
      next: r => {
        this.parkingReservations[parkingId] = r.data || [];
      }
    });
  }

  loadStatsForParking(parkingId: string): void {
    this.reservationService.getParkingStats(parkingId).subscribe({
      next: r => {
        this.parkingStats[parkingId] = r.data || null;
      }
    });
  }

  onSubmitParking(event: Event): void {
    event.preventDefault();
    if (!this.parkingName || !this.parkingAddress || !this.parkingCity || !this.parkingZip || !this.parkingSpots || this.parkingPrice === null) {
      this.showToast('Veuillez remplir tous les champs du parking', 'error');
      return;
    }
    this.isLoading = true;
    this.userService.submitParkingRequest({
      name: this.parkingName,
      address: this.parkingAddress,
      city: this.parkingCity,
      zipCode: this.parkingZip,
      totalSpots: this.parkingSpots,
      pricePerHour: this.parkingPrice
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.parkingSubmitted = true;
        this.showToast('Demande de parking envoyée ! L\'administrateur a été notifié.');
        this.parkingName = this.parkingAddress = this.parkingCity = this.parkingZip = '';
        this.parkingSpots = this.parkingPrice = null;
        this.loadParkings();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la soumission', 'error');
      }
    });
  }

  onCreateEmployee(event: Event): void {
    event.preventDefault();
    if (!this.empName || !this.empEmail || !this.empPassword || !this.empPhone || !this.empParkingId) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }
    this.isLoading = true;
    this.userService.createEmployee({
      name: this.empName,
      email: this.empEmail,
      password: this.empPassword,
      phone: this.empPhone,
      parkingId: this.empParkingId,
      position: this.empPosition
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Employé créé ! Un email avec ses identifiants lui a été envoyé.');
        this.empName = this.empEmail = this.empPassword = this.empPhone = this.empParkingId = '';
        this.loadEmployees();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  onCreatePlan(event: Event): void {
    event.preventDefault();
    if (!this.planName || !this.planParkingId || this.planPrice === null || !this.planDurationDays) {
      this.showToast('Veuillez remplir les champs obligatoires du forfait', 'error');
      return;
    }

    const features = this.planFeaturesInput
      ? this.planFeaturesInput.split(',').map(f => f.trim()).filter(f => f.length > 0)
      : [];

    this.isLoading = true;
    this.subscriptionService.createPlan({
      name: this.planName,
      description: this.planDescription,
      parkingId: this.planParkingId,
      price: this.planPrice,
      durationDays: this.planDurationDays,
      features
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Plan d\'abonnement créé avec succès !');
        this.planName = this.planDescription = this.planParkingId = this.planFeaturesInput = '';
        this.planPrice = this.planDurationDays = null;
        this.loadParkings(); // Reload to refresh plans list
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la création du plan', 'error');
      }
    });
  }

  togglePlanStatus(planId: string, currentStatus: boolean, parkingId: string): void {
    this.subscriptionService.updatePlan(planId, { isActive: !currentStatus }).subscribe({
      next: () => {
        this.showToast('Statut du plan d\'abonnement mis à jour.');
        this.loadPlansForParking(parkingId);
      },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }

  onUpdateProfile(event: Event): void {
    event.preventDefault();

    const validationError = this.getProfileValidationError();
    if (validationError) {
      this.showToast(validationError, 'error');
      return;
    }

    const payload: any = {
      name: this.profileName.trim(),
      phone: this.normalizePhone(this.profilePhone),
      address: this.profileAddress.trim(),
      siret: this.profileSiret.replace(/\s/g, '') || null
    };

    if (this.profilePassword) {
      payload.password = this.profilePassword;
    }

    this.profileSaving = true;
    this.userService.updateMe(payload).subscribe({
      next: (r) => {
        this.profileSaving = false;
        this.profile = r.user;
        this.profilePassword = '';
        this.profilePasswordConfirm = '';
        this.authService.updateCurrentUserValue({
          name: r.user.name,
          phone: r.user.phone
        });
        this.showToast('Profil entreprise mis à jour avec succès.');
      },
      error: (e) => {
        this.profileSaving = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  getApprovedParkings() {
    return this.parkings.filter(p => p.status === 'approved');
  }

  loadComplaints(): void {
    this.complaintService.getCompanyComplaints(this.complaintStatusFilter || undefined).subscribe({
      next: (res) => { this.complaints = res.data || []; },
      error: () => { this.complaints = []; }
    });
  }

  openComplaint(c: any): void {
    this.selectedComplaint = c;
    this.complaintResponseNote = c.responseNote || '';
    this.complaintResolveNote = c.resolutionNote || '';
    this.complaintRejectReason = '';
  }

  closeComplaint(): void {
    this.selectedComplaint = null;
  }

  respondComplaint(): void {
    if (!this.selectedComplaint || !this.complaintResponseNote.trim()) return;
    this.complaintActionLoading = true;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.respondToComplaint(id, this.complaintResponseNote.trim()).subscribe({
      next: () => {
        this.complaintActionLoading = false;
        this.showToast('Réponse envoyée au client.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (e) => {
        this.complaintActionLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  resolveComplaint(): void {
    if (!this.selectedComplaint || !this.complaintResolveNote.trim()) return;
    this.complaintActionLoading = true;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.resolveComplaint(id, this.complaintResolveNote.trim()).subscribe({
      next: () => {
        this.complaintActionLoading = false;
        this.showToast('Réclamation marquée comme résolue.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (e) => {
        this.complaintActionLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  rejectComplaint(): void {
    if (!this.selectedComplaint || !this.complaintRejectReason.trim()) return;
    this.complaintActionLoading = true;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.rejectComplaint(id, this.complaintRejectReason.trim()).subscribe({
      next: () => {
        this.complaintActionLoading = false;
        this.showToast('Réclamation rejetée.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (e) => {
        this.complaintActionLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  escalateComplaintToAdmin(): void {
    if (!this.selectedComplaint) return;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.escalateComplaint(id).subscribe({
      next: () => {
        this.showToast('Réclamation escaladée.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }

  getComplaintStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente', in_progress: 'En cours', resolved: 'Résolue',
      closed: 'Clôturée', rejected: 'Rejetée', escalated: 'Escaladée'
    };
    return map[status] || status;
  }

  getPendingComplaintsCount(): number {
    return this.complaints.filter(c => c.status === 'pending' || c.status === 'escalated').length;
  }
}
