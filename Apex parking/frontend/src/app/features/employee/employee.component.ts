import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { ParkingService } from '../../core/services/parking.service';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { ComplaintService } from '../../core/services/complaint.service';

@Component({
  selector: 'app-employee',
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  activeSection: 'dashboard' | 'spots' | 'reservations' | 'scanner' | 'complaints' | 'profile' = 'dashboard';
  
  // State variables
  profile: any = null;
  parking: any = null;
  spots: any[] = [];
  reservations: any[] = [];
  complaints: any[] = [];
  selectedComplaint: any = null;
  complaintResponseNote = '';
  complaintResolveNote = '';
  complaintActionLoading = false;
  stats: any = {
    total: 0,
    available: 0,
    occupied: 0,
    maintenance: 0,
    reserved: 0
  };

  // Profile update form
  profileName = '';
  profilePhone = '';
  profilePassword = '';
  profilePasswordConfirm = '';
  profileLoadError: string | null = null;
  profileSaving = false;

  // QR scanning state
  searchQrCode = '';
  scannedReservation: any = null;

  // Selected spot for editing status
  selectedSpot: any = null;
  selectedSpotNewStatus = '';

  // UI state
  isLoading = false;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  constructor(
    private userService: UserService,
    private parkingService: ParkingService,
    private reservationService: ReservationService,
    private complaintService: ComplaintService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadInitialData(): void {
    this.isLoading = true;
    this.profileLoadError = null;
    this.userService.getMe().subscribe({
      next: (res) => {
        this.profile = res.user;
        this.resetProfileForm();

        const parkingId = this.profile.parkingId?._id || this.profile.parkingId;
        if (parkingId) {
          if (this.profile.parkingId?.name) {
            this.parking = this.profile.parkingId;
          }
          this.loadParkingAndSpots(String(parkingId));
          this.loadReservations(String(parkingId));
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.isLoading = false;
        this.profileLoadError = 'Erreur lors du chargement du profil employé.';
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
    const name = (this.profileName || this.profile?.name || 'E').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getPositionLabel(): string {
    const map: Record<string, string> = {
      agent: 'Agent de terrain',
      supervisor: 'Superviseur',
      manager: 'Manager'
    };
    return map[this.profile?.position || ''] || 'Employé';
  }

  getOccupancyRate(): number {
    if (!this.stats.total) return 0;
    return Math.round(((this.stats.occupied + this.stats.reserved) / this.stats.total) * 100);
  }

  getActiveReservationsCount(): number {
    return this.reservations.filter(r => ['pending', 'confirmed', 'active'].includes(r.status)).length;
  }

  getCompletedReservationsCount(): number {
    return this.reservations.filter(r => r.status === 'completed').length;
  }

  getParkingName(): string {
    return this.parking?.name || this.profile?.parkingId?.name || 'Non assigné';
  }

  getCompanyName(): string {
    return this.profile?.companyId?.name || '—';
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

  loadParkingAndSpots(parkingId: string): void {
    this.parkingService.getParkingLocationById(parkingId).subscribe({
      next: (res) => {
        this.parking = res.data;
      }
    });

    this.parkingService.getSpotsByParking(parkingId).subscribe({
      next: (res) => {
        this.spots = res.data || [];
        this.calculateSpotStats();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des places.', 'error');
      }
    });
  }

  loadReservations(parkingId: string): void {
    this.reservationService.getParkingReservations(parkingId).subscribe({
      next: (res) => {
        this.reservations = res.data || [];
      }
    });
  }

  calculateSpotStats(): void {
    const total = this.spots.length;
    const available = this.spots.filter(s => s.status === 'available').length;
    const occupied = this.spots.filter(s => s.status === 'occupied').length;
    const maintenance = this.spots.filter(s => s.status === 'maintenance').length;
    const reserved = this.spots.filter(s => s.status === 'reserved').length;

    this.stats = { total, available, occupied, maintenance, reserved };
  }

  selectSpot(spot: any): void {
    this.selectedSpot = spot;
    this.selectedSpotNewStatus = spot.status;
  }

  onUpdateSpotStatus(): void {
    if (!this.selectedSpot) return;

    this.isLoading = true;
    this.parkingService.updateSpotStatus(this.selectedSpot._id, this.selectedSpotNewStatus).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast(`Statut de la place ${this.selectedSpot.spotNumber} mis à jour avec succès.`);
        this.selectedSpot = null;
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la mise à jour du statut.', 'error');
      }
    });
  }

  onSearchQr(event?: Event): void {
    if (event) event.preventDefault();
    if (!this.searchQrCode.trim()) {
      this.showToast('Veuillez saisir un code QR', 'error');
      return;
    }

    this.isLoading = true;
    this.scannedReservation = null;
    this.reservationService.verifyByQrCode(this.searchQrCode.trim()).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.scannedReservation = res.data;
        if (!this.scannedReservation) {
          this.showToast('Réservation introuvable pour ce QR code.', 'error');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Code QR invalide ou réservation introuvable.', 'error');
      }
    });
  }

  onCheckIn(resId: string): void {
    this.isLoading = true;
    this.reservationService.checkIn(resId, this.searchQrCode).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Check-in effectué ! Le véhicule est garé.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du check-in.', 'error');
      }
    });
  }

  onCheckOut(resId: string): void {
    this.isLoading = true;
    this.reservationService.checkOut(resId).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Check-out effectué ! La place est maintenant libre.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du check-out.', 'error');
      }
    });
  }

  onMarkNoShow(resId: string): void {
    if (!confirm('Voulez-vous marquer cette réservation comme non présentée (No Show) ?')) return;

    this.isLoading = true;
    this.reservationService.markNoShow(resId).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Réservation marquée comme No Show.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur.', 'error');
      }
    });
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
        this.showToast('Profil employé mis à jour avec succès.');
      },
      error: (err) => {
        this.profileSaving = false;
        this.showToast(err.error?.message || 'Erreur lors de la mise à jour.', 'error');
      }
    });
  }

  loadComplaints(): void {
    const parkingId = this.profile?.parkingId?._id || this.profile?.parkingId;
    if (!parkingId) {
      this.complaints = [];
      return;
    }
    this.complaintService.getParkingComplaints(String(parkingId)).subscribe({
      next: (res) => { this.complaints = res.data || []; },
      error: () => { this.complaints = []; }
    });
  }

  openComplaint(c: any): void {
    this.selectedComplaint = c;
    this.complaintResponseNote = c.responseNote || '';
    this.complaintResolveNote = c.resolutionNote || '';
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
        this.showToast('Réponse envoyée.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (err) => {
        this.complaintActionLoading = false;
        this.showToast(err.error?.message || 'Erreur', 'error');
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
        this.showToast('Réclamation résolue.');
        this.loadComplaints();
        this.closeComplaint();
      },
      error: (err) => {
        this.complaintActionLoading = false;
        this.showToast(err.error?.message || 'Erreur', 'error');
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
}
