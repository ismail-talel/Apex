import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';
import { ParkingService } from '../../core/services/parking.service';
import { ReservationService } from '../../core/services/reservation.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ComplaintService } from '../../core/services/complaint.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  companies: any[] = [];
  parkings: any[] = [];
  allSubscriptions: any[] = [];
  allReservations: any[] = [];
  allComplaints: any[] = [];
  complaintStatusFilter = '';
  complaintPriorityFilter = '';
  selectedComplaint: any = null;
  complaintResolveNote = '';
  complaintRejectReason = '';
  complaintActionLoading = false;
  profile: any = null;

  activeSection: 'companies' | 'parkings' | 'dashboard' | 'subscriptions' | 'reservations' | 'complaints' | 'profile' = 'companies';
  mapStatistics: any = null;
  
  // Profile inputs
  profileName = '';
  profilePhone = '';
  profilePassword = '';
  profilePasswordConfirm = '';
  profileLoadError: string | null = null;
  profileSaving = false;

  // Rejection modal helper state
  rejectReason = '';
  rejectTargetId: string | null = null;
  rejectType: 'company' | 'parking' = 'company';

  // Parking requests
  parkingFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  selectedParking: any = null;
  parkingActionId: string | null = null;

  // UI State
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private parkingService: ParkingService,
    private reservationService: ReservationService,
    private subscriptionService: SubscriptionService,
    private userService: UserService,
    private complaintService: ComplaintService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadCompanies();
    this.loadParkings();
    this.loadMapStatistics();
    this.loadAllSubscriptions();
    this.loadAllReservations();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadProfile(): void {
    this.profileLoadError = null;
    this.userService.getMe().subscribe({
      next: (res) => {
        this.profile = res.user;
        this.resetProfileForm();
      },
      error: () => {
        this.profileLoadError = 'Impossible de charger votre profil administrateur.';
        this.showToast(this.profileLoadError, 'error');
      }
    });
  }

  resetProfileForm(): void {
    if (!this.profile) return;
    this.profileName = this.profile.name || '';
    this.profilePhone = this.profile.phone || '';
    this.profilePassword = '';
    this.profilePasswordConfirm = '';
  }

  getProfileInitials(): string {
    const name = (this.profileName || this.profile?.name || 'A').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getRoleLabel(): string {
    return 'Super Administrateur';
  }

  countByStatus(items: any[], status: string): number {
    return items.filter(item => item.status === status).length;
  }

  getPendingCompaniesCount(): number {
    return this.countByStatus(this.companies, 'pending');
  }

  getPendingParkingsCount(): number {
    return this.countByStatus(this.parkings, 'pending');
  }

  getActiveReservationsCount(): number {
    return this.allReservations.filter(r => ['pending', 'confirmed', 'active'].includes(r.status)).length;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private getProfileValidationError(): string | null {
    if (!this.profileName.trim()) {
      return 'Le nom complet est obligatoire.';
    }

    const phone = this.normalizePhone(this.profilePhone);
    if (!phone || phone.length < 8 || phone.length > 10) {
      return 'Le téléphone doit contenir entre 8 et 10 chiffres.';
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

  loadCompanies(): void {
    this.adminService.getCompanies().subscribe({ 
      next: r => this.companies = r.companies || [], 
      error: () => this.showToast('Erreur chargement entreprises', 'error') 
    });
  }

  loadParkings(): void {
    this.adminService.getParkings().subscribe({ 
      next: r => this.parkings = r.parkings || [], 
      error: () => this.showToast('Erreur chargement parkings', 'error') 
    });
  }

  loadMapStatistics(): void {
    this.parkingService.getMapStatistics().subscribe({
      next: (res) => {
        this.mapStatistics = res?.data || null;
      }
    });
  }

  refreshDashboard(): void {
    this.loadParkings();
    this.loadMapStatistics();
    this.loadAllReservations();
  }

  getApprovedParkings(): any[] {
    return this.parkings.filter(p => p.status === 'approved');
  }

  getTotalSpots(): number {
    return this.getApprovedParkings().reduce((sum, p) => sum + (p.totalSpots || 0), 0);
  }

  getAvailableSpots(): number {
    return this.getApprovedParkings().reduce((sum, p) => sum + (p.availableSpots || 0), 0);
  }

  getOccupiedSpots(): number {
    return Math.max(0, this.getTotalSpots() - this.getAvailableSpots());
  }

  getGlobalOccupancyRate(): number {
    const total = this.getTotalSpots();
    if (!total) return 0;
    return Math.round((this.getOccupiedSpots() / total) * 100);
  }

  getAveragePricePerHour(): string {
    const approved = this.getApprovedParkings();
    if (!approved.length) return '0';
    const avg = approved.reduce((sum, p) => sum + (p.pricePerHour || 0), 0) / approved.length;
    return avg.toFixed(1);
  }

  getAverageRating(): string {
    const rated = this.getApprovedParkings().filter(p => (p.rating || 0) > 0);
    if (!rated.length) return '—';
    const avg = rated.reduce((sum, p) => sum + p.rating, 0) / rated.length;
    return avg.toFixed(1);
  }

  getTotalRevenue(): number {
    return this.allReservations
      .filter(r => ['confirmed', 'active', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  }

  getParkingReservationCount(parkingId: string): number {
    return this.allReservations.filter(r => {
      const id = r.parkingId?._id || r.parkingId;
      return String(id) === String(parkingId);
    }).length;
  }

  getParkingRevenue(parkingId: string): number {
    return this.allReservations
      .filter(r => {
        const id = r.parkingId?._id || r.parkingId;
        return String(id) === String(parkingId) && ['confirmed', 'active', 'completed'].includes(r.status);
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  }

  getParkingOccupancyRate(parking: any): number {
    const total = parking.totalSpots || 0;
    if (!total) return 0;
    const available = parking.availableSpots ?? 0;
    return Math.round(((total - available) / total) * 100);
  }

  getParkingsByCity(): Array<{ city: string; count: number; spots: number }> {
    const map = new Map<string, { count: number; spots: number }>();
    for (const parking of this.parkings) {
      const city = parking.city || 'Inconnue';
      const current = map.get(city) || { count: 0, spots: 0 };
      current.count += 1;
      current.spots += parking.totalSpots || 0;
      map.set(city, current);
    }
    return Array.from(map.entries())
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  getMaxCityCount(): number {
    const cities = this.getParkingsByCity();
    return cities.length ? Math.max(...cities.map(c => c.count)) : 1;
  }

  getStatusBreakdown(): Array<{ label: string; key: string; count: number; className: string }> {
    return [
      { label: 'Approuvés', key: 'approved', count: this.countByStatus(this.parkings, 'approved'), className: 'approved' },
      { label: 'En attente', key: 'pending', count: this.countByStatus(this.parkings, 'pending'), className: 'pending' },
      { label: 'Rejetés', key: 'rejected', count: this.countByStatus(this.parkings, 'rejected'), className: 'rejected' }
    ];
  }

  getReservationStatusBreakdown(): Array<{ label: string; count: number; className: string }> {
    const statuses = [
      { label: 'En attente', key: 'pending', className: 'pending' },
      { label: 'Confirmées', key: 'confirmed', className: 'approved' },
      { label: 'Actives', key: 'active', className: 'active' },
      { label: 'Terminées', key: 'completed', className: 'completed' },
      { label: 'Annulées', key: 'cancelled', className: 'rejected' }
    ];
    return statuses.map(s => ({
      label: s.label,
      className: s.className,
      count: this.allReservations.filter(r => r.status === s.key).length
    }));
  }

  getMaxReservationStatusCount(): number {
    const counts = this.getReservationStatusBreakdown().map(s => s.count);
    return counts.length ? Math.max(...counts, 1) : 1;
  }

  getParkingDashboardRows(): any[] {
    return [...this.parkings]
      .map(p => ({
        ...p,
        reservationCount: this.getParkingReservationCount(p._id),
        revenue: this.getParkingRevenue(p._id),
        occupancyRate: p.status === 'approved' ? this.getParkingOccupancyRate(p) : null
      }))
      .sort((a, b) => (b.reservationCount - a.reservationCount) || (b.revenue - a.revenue));
  }

  getOccupancyClass(rate: number | null): string {
    if (rate === null) return 'neutral';
    if (rate >= 80) return 'high';
    if (rate >= 50) return 'medium';
    return 'low';
  }

  loadAllSubscriptions(): void {
    this.subscriptionService.getAllSubscriptions().subscribe({
      next: r => this.allSubscriptions = r.subscriptions || []
    });
  }

  loadAllReservations(): void {
    this.reservationService.getAllReservations().subscribe({
      next: r => this.allReservations = r.data || []
    });
  }

  approveCompany(id: string): void {
    this.adminService.approveCompany(id).subscribe({ 
      next: () => { this.showToast('Entreprise approuvée'); this.loadCompanies(); }, 
      error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
    });
  }

  suspendCompany(id: string): void {
    this.adminService.suspendCompany(id).subscribe({ 
      next: () => { this.showToast('Entreprise suspendue'); this.loadCompanies(); }, 
      error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
    });
  }

  openRejectModal(id: string, type: 'company' | 'parking'): void {
    this.rejectTargetId = id;
    this.rejectType = type;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectTargetId) return;
    if (this.rejectType === 'company') {
      this.adminService.rejectCompany(this.rejectTargetId, this.rejectReason).subscribe({ 
        next: () => { this.showToast('Entreprise rejetée'); this.loadCompanies(); this.rejectTargetId = null; }, 
        error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
      });
    } else {
      this.adminService.rejectParking(this.rejectTargetId, this.rejectReason).subscribe({ 
        next: () => {
          this.showToast('Parking rejeté');
          this.loadParkings();
          if (this.selectedParking?._id === this.rejectTargetId) {
            this.selectedParking = {
              ...this.selectedParking,
              status: 'rejected',
              rejectionReason: this.rejectReason || 'Non conforme aux critères requis.'
            };
          }
          this.rejectTargetId = null;
        },
        error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
      });
    }
  }

  approveParking(id: string, name?: string): void {
    const label = name ? `« ${name} »` : 'ce parking';
    if (!confirm(`Approuver la demande de parking ${label} ?`)) return;

    this.parkingActionId = id;
    this.adminService.approveParking(id).subscribe({
      next: () => {
        this.parkingActionId = null;
        this.showToast('Parking approuvé avec succès');
        this.loadParkings();
        if (this.selectedParking?._id === id) {
          this.selectedParking = { ...this.selectedParking, status: 'approved', isBlocked: false, rejectionReason: null };
        }
      },
      error: e => {
        this.parkingActionId = null;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  blockParking(id: string, name?: string): void {
    const label = name ? `« ${name} »` : 'ce parking';
    if (!confirm(`Bloquer le parking ${label} ? Il ne sera plus visible sur la carte.`)) return;

    this.parkingActionId = id;
    this.adminService.blockParking(id).subscribe({
      next: () => {
        this.parkingActionId = null;
        this.showToast('Parking bloqué');
        this.loadParkings();
        if (this.selectedParking?._id === id) {
          this.selectedParking = { ...this.selectedParking, isBlocked: true };
        }
      },
      error: e => {
        this.parkingActionId = null;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  unblockParking(id: string, name?: string): void {
    this.parkingActionId = id;
    this.adminService.unblockParking(id).subscribe({
      next: () => {
        this.parkingActionId = null;
        this.showToast('Parking débloqué');
        this.loadParkings();
        if (this.selectedParking?._id === id) {
          this.selectedParking = { ...this.selectedParking, isBlocked: false };
        }
      },
      error: e => {
        this.parkingActionId = null;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  generateParkingSpots(id: string, name?: string): void {
    const label = name ? `« ${name} »` : 'ce parking';
    if (!confirm(`Générer ou régénérer les places pour ${label} ?`)) return;

    this.parkingActionId = id;
    this.parkingService.generateSpots(id).subscribe({
      next: () => {
        this.parkingActionId = null;
        this.showToast('Places générées avec succès');
        this.loadParkings();
      },
      error: e => {
        this.parkingActionId = null;
        this.showToast(e.error?.message || 'Erreur lors de la génération.', 'error');
      }
    });
  }

  openParkingDetails(parking: any): void {
    this.selectedParking = parking;
  }

  closeParkingDetails(): void {
    this.selectedParking = null;
  }

  setParkingFilter(filter: 'all' | 'pending' | 'approved' | 'rejected'): void {
    this.parkingFilter = filter;
  }

  getFilteredParkings(): any[] {
    if (this.parkingFilter === 'all') return this.parkings;
    return this.parkings.filter(p => p.status === this.parkingFilter);
  }

  getParkingStatusLabel(parking: any): string {
    if (parking.status === 'approved' && parking.isBlocked) return 'Bloqué';
    const map: Record<string, string> = {
      pending: 'En attente',
      approved: 'Approuvé',
      rejected: 'Rejeté'
    };
    return map[parking.status] || parking.status;
  }

  getParkingStatusClass(parking: any): string {
    if (parking.status === 'approved' && parking.isBlocked) return 'badge-suspended';
    return `badge-${parking.status}`;
  }

  isParkingActionLoading(id: string): boolean {
    return this.parkingActionId === id;
  }

  onUpdateProfile(event: Event): void {
    event.preventDefault();

    const validationError = this.getProfileValidationError();
    if (validationError) {
      this.showToast(validationError, 'error');
      return;
    }

    const updates: any = {
      name: this.profileName.trim(),
      phone: this.normalizePhone(this.profilePhone)
    };

    if (this.profilePassword) {
      updates.password = this.profilePassword;
    }

    this.profileSaving = true;
    this.userService.updateMe(updates).subscribe({
      next: (res) => {
        this.profileSaving = false;
        this.profile = res.user;
        this.profilePassword = '';
        this.profilePasswordConfirm = '';
        this.authService.updateCurrentUserValue({
          name: res.user.name,
          phone: res.user.phone
        });
        this.showToast('Profil administrateur mis à jour avec succès.');
      },
      error: (e) => {
        this.profileSaving = false;
        this.showToast(e.error?.message || 'Erreur lors de la mise à jour.', 'error');
      }
    });
  }

  loadAllComplaints(): void {
    this.complaintService.getAllComplaints({
      status: this.complaintStatusFilter || undefined,
      priority: this.complaintPriorityFilter || undefined
    }).subscribe({
      next: (res) => { this.allComplaints = res.data || []; },
      error: () => { this.allComplaints = []; }
    });
  }

  openComplaint(c: any): void {
    this.selectedComplaint = c;
    this.complaintResolveNote = c.resolutionNote || '';
    this.complaintRejectReason = '';
  }

  closeComplaint(): void {
    this.selectedComplaint = null;
  }

  adminResolveComplaint(): void {
    if (!this.selectedComplaint || !this.complaintResolveNote.trim()) return;
    this.complaintActionLoading = true;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.resolveComplaint(id, this.complaintResolveNote.trim()).subscribe({
      next: () => {
        this.complaintActionLoading = false;
        this.showToast('Réclamation résolue.');
        this.loadAllComplaints();
        this.closeComplaint();
      },
      error: (e) => {
        this.complaintActionLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  adminRejectComplaint(): void {
    if (!this.selectedComplaint || !this.complaintRejectReason.trim()) return;
    this.complaintActionLoading = true;
    const id = this.selectedComplaint._id || this.selectedComplaint.id;
    this.complaintService.rejectComplaint(id, this.complaintRejectReason.trim()).subscribe({
      next: () => {
        this.complaintActionLoading = false;
        this.showToast('Réclamation rejetée.');
        this.loadAllComplaints();
        this.closeComplaint();
      },
      error: (e) => {
        this.complaintActionLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  getComplaintStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente', in_progress: 'En cours', resolved: 'Résolue',
      closed: 'Clôturée', rejected: 'Rejetée', escalated: 'Escaladée'
    };
    return map[status] || status;
  }

  getEscalatedComplaintsCount(): number {
    return this.allComplaints.filter(c => c.status === 'escalated').length;
  }
}
