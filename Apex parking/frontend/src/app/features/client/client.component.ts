import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from '../../core/services/reservation.service';
import { ParkingService } from '../../core/services/parking.service';
import { UserService } from '../../core/services/user.service';
import { ComplaintService } from '../../core/services/complaint.service';
import { WebauthnService } from '../../core/services/webauthn.service';
import { FaceAuthService } from '../../core/services/face-auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent implements OnInit, OnDestroy {
  activeSection: 'parkings' | 'subscriptions' | 'reservations' | 'complaints' | 'profile' = 'parkings';
  
  // Data lists
  parkings: any[] = [];
  selectedParking: any = null;
  plans: any[] = [];
  mySubscriptions: any[] = [];
  myReservations: any[] = [];
  myComplaints: any[] = [];

  // Complaints
  complaintParkingId = '';
  complaintReservationId = '';
  complaintSubject = '';
  complaintCategory = 'other';
  complaintDescription = '';
  complaintPriority = 'medium';
  complaintSubmitting = false;
  selectedComplaint: any = null;

  // Profile data
  profile: any = null;
  profileName = '';
  profilePhone = '';
  profileCin = '';
  profilePlate = '';
  profileSerial = '';
  profileVehicleType = 'car';
  profilePaymentMethod = 'card';
  profileEmailNotifications = true;
  profileSmsNotifications = false;
  profileEmail = '';
  profilePassword = '';
  profilePasswordConfirm = '';
  profileSaving = false;
  profileLoadError = '';
  securityLoading = false;
  passkeySupported = false;
  faceEnrollCameraActive = false;
  faceAuthMockMode = false;

  @ViewChild('enrollVideo') enrollVideoRef?: ElementRef<HTMLVideoElement>;

  // Booking details
  selectedParkingForBooking: any = null;
  bookingSpots: any[] = [];
  bookingSpotId = '';
  bookingVehiclePlate = '';
  bookingVehicleType = 'car';
  bookingStartTime = '';
  bookingEndTime = '';
  bookingNotes = '';
  bookingPaymentMethod = 'card';

  // Confirmation modal (paiement + expiration 15 min)
  selectedResForConfirm: any = null;
  confirmPaymentMethod = 'card';
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  countdownTick = 0;

  // Review modal state
  selectedResForReview: any = null;
  reviewRating = 5;
  reviewComment = '';

  // UI state
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;
  isBooking = false;
  isConfirming = false;
  isLoadingParkings = false;
  isBuyingSubscription = false;
  isConfirmingSubscription = false;
  subscriptionParkingFilter: any = null;
  selectedPlanForPayment: any = null;
  selectedSubscriptionForPayment: any = null;

  constructor(
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
    private reservationService: ReservationService,
    private parkingService: ParkingService,
    private userService: UserService,
    private complaintService: ComplaintService,
    public authService: AuthService,
    private webauthnService: WebauthnService,
    private faceAuthService: FaceAuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.passkeySupported = this.webauthnService.isSupported();
    this.faceAuthService.getStatus().subscribe({
      next: (status) => { this.faceAuthMockMode = !!status.mockMode; }
    });
    this.route.queryParams.subscribe(params => {
      const section = params['section'];
      if (section === 'reservations' || section === 'subscriptions' || section === 'profile' || section === 'parkings' || section === 'complaints') {
        this.activeSection = section;
      }

      const bookParkingId = params['book'];
      if (bookParkingId) {
        this.openBookingForParking(bookParkingId);
      }

      this.handlePaymentReturn(params);
    });

    this.loadProfile();
    this.loadParkings();
    this.loadMySubscriptions();
    this.loadMyReservations();
    this.loadMyComplaints();
    this.countdownTimer = setInterval(() => {
      this.countdownTick++;
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.stopFaceEnrollCamera();
  }

  private handlePaymentReturn(params: Record<string, string>): void {
    const paymentStatus = params['payment'];
    const reservationId = params['reservationId'];
    const subscriptionId = params['subscriptionId'];
    const paymentRef = params['payment_ref'];

    if (subscriptionId && paymentStatus) {
      this.activeSection = 'subscriptions';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { section: 'subscriptions' },
        replaceUrl: true
      });

      if (paymentStatus === 'failed') {
        this.showToast('Paiement annulé ou échoué. Réessayez avec votre carte bancaire.', 'error');
        this.loadMySubscriptions();
        return;
      }

      if (paymentStatus === 'success') {
        this.isBuyingSubscription = true;
        this.subscriptionService.verifySubscriptionPayment(subscriptionId, paymentRef).subscribe({
          next: () => {
            this.isBuyingSubscription = false;
            this.showToast('Paiement confirmé. Votre abonnement est maintenant actif !');
            this.loadMySubscriptions();
            this.closeSubscriptionPaymentModal();
          },
          error: (err) => {
            this.isBuyingSubscription = false;
            this.showToast(this.getApiErrorMessage(err, 'Erreur lors de la vérification du paiement.'), 'error');
            this.loadMySubscriptions();
          }
        });
      }
      return;
    }

    if (!paymentStatus || !reservationId) return;

    this.activeSection = 'reservations';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: 'reservations' },
      replaceUrl: true
    });

    if (paymentStatus === 'failed') {
      this.showToast('Paiement annulé ou échoué. Réessayez avec votre carte bancaire.', 'error');
      this.loadMyReservations();
      return;
    }

    if (paymentStatus === 'success') {
      this.isConfirming = true;
      this.reservationService.verifyReservationPayment(reservationId, paymentRef).subscribe({
        next: () => {
          this.isConfirming = false;
          this.showToast('Paiement Konnect confirmé. Réservation validée.');
          this.loadMyReservations();
        },
        error: (err) => {
          this.isConfirming = false;
          this.showToast(this.getApiErrorMessage(err, 'Erreur lors de la vérification du paiement.'), 'error');
          this.loadMyReservations();
        }
      });
    }
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  private getApiErrorMessage(err: any, fallback: string): string {
    if (!err) return fallback;
    if (err.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez que le backend est démarré (port 5000).';
    }

    const body = err?.error;
    if (!body) return fallback;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (body.message && body.message !== 'Erreur de validation') {
      return body.message;
    }

    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0];
      if (typeof first === 'string') return first;
      return first?.msg || first?.message || fallback;
    }

    return body.message || fallback;
  }

  loadProfile(): void {
    this.profileLoadError = '';
    this.userService.getMe().subscribe({
      next: (res) => {
        this.profile = res.user;
        this.profileName = this.profile.name || '';
        this.profileEmail = this.profile.email || '';
        this.profilePhone = this.profile.phone || '';
        this.profileCin = this.profile.cin || '';
        this.profilePlate = this.profile.vehiclePlate || '';
        this.profileSerial = this.profile.vehicleSerialNumber || '';
        this.profileVehicleType = this.profile.vehicleType || 'car';
        this.profilePaymentMethod = this.profile.preferredPaymentMethod || 'card';
        this.profileEmailNotifications = this.profile.emailNotifications !== false;
        this.profileSmsNotifications = this.profile.smsNotifications === true;
      },
      error: () => {
        this.profileLoadError = 'Impossible de charger votre profil.';
        this.showToast(this.profileLoadError, 'error');
      }
    });
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

    if (!this.profileEmail.trim() || !/^\S+@\S+\.\S+$/.test(this.profileEmail.trim())) {
      return 'Veuillez saisir un email valide.';
    }

    if (this.profileCin.trim() && !/^[A-Z0-9]{6,15}$/i.test(this.profileCin.trim())) {
      return 'Le numéro CIN / passeport est invalide.';
    }

    if (this.profilePlate.trim() && !/^[A-Z0-9]{5,10}$/i.test(this.profilePlate.trim())) {
      return 'La plaque d\'immatriculation est invalide (ex: AA123BB).';
    }

    if (this.profileSerial.trim() && !/^[A-Z0-9]{5,20}$/i.test(this.profileSerial.trim())) {
      return 'Le numéro de série du véhicule est invalide.';
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

  loadParkings(): void {
    this.isLoadingParkings = true;
    this.parkingService.getParkingLocations().subscribe({
      next: (res) => {
        this.isLoadingParkings = false;
        if (res.success === false) {
          this.showToast(res.error || res.message || 'Erreur lors du chargement des parkings.', 'error');
          this.parkings = [];
          return;
        }
        this.parkings = res.data || [];
      },
      error: () => {
        this.isLoadingParkings = false;
        this.showToast('Erreur lors du chargement des parkings.', 'error');
      }
    });
  }

  loadMySubscriptions(): void {
    this.subscriptionService.getMySubscriptions().subscribe({
      next: (res) => {
        this.mySubscriptions = res.subscriptions || [];
      },
      error: () => {
        this.showToast('Erreur lors du chargement de vos abonnements.', 'error');
      }
    });
  }

  loadMyReservations(): void {
    this.reservationService.getMyReservations().subscribe({
      next: (res) => {
        this.myReservations = (res.data || []).map((r: any) => {
          const id = this.getReservationId(r);
          return id ? { ...r, _id: id } : r;
        });
      },
      error: () => {
        this.showToast('Erreur lors du chargement de vos réservations.', 'error');
      }
    });
  }

  selectParking(parking: any): void {
    this.selectedParking = parking;
    this.subscriptionParkingFilter = parking;
    this.plans = [];
    this.isLoading = true;
    this.subscriptionService.getPlansForParking(parking.id || parking._id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.plans = res.plans || [];
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des forfaits.', 'error');
      }
    });
  }

  openSubscriptionsForParking(parking: any): void {
    this.activeSection = 'subscriptions';
    this.selectedParking = null;
    this.selectedParkingForBooking = null;
    this.subscriptionParkingFilter = parking;
    this.loadPlansForParking(parking);
  }

  loadPlansForParking(parking: any): void {
    if (!parking) return;
    this.isLoading = true;
    this.subscriptionService.getPlansForParking(parking.id || parking._id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.plans = res.plans || [];
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des forfaits.', 'error');
      }
    });
  }

  clearSubscriptionParkingFilter(): void {
    this.subscriptionParkingFilter = null;
    this.plans = [];
  }

  getActiveSubscriptions(): any[] {
    return this.mySubscriptions.filter(s => s.status === 'active');
  }

  hasActiveSubscriptionForParking(parkingId: string): boolean {
    const id = String(parkingId);
    return this.mySubscriptions.some(s => {
      const pid = s.parkingId?._id || s.parkingId;
      return String(pid) === id && s.status === 'active';
    });
  }

  getSubscriptionStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente de paiement',
      active: 'Actif',
      expired: 'Expiré',
      cancelled: 'Annulé'
    };
    return map[status] || status;
  }

  buySubscription(plan: any): void {
    this.selectedPlanForPayment = plan;
    this.selectedSubscriptionForPayment = null;
  }

  openSubscriptionPaymentModal(sub: any): void {
    this.selectedSubscriptionForPayment = sub;
    this.selectedPlanForPayment = null;
    this.activeSection = 'subscriptions';
  }

  closeSubscriptionPaymentModal(): void {
    this.selectedPlanForPayment = null;
    this.selectedSubscriptionForPayment = null;
  }

  getSubscriptionPaymentPlan(): any {
    if (this.selectedPlanForPayment) return this.selectedPlanForPayment;
    return this.selectedSubscriptionForPayment?.planId;
  }

  getSubscriptionPaymentParking(): any {
    if (this.selectedPlanForPayment && this.subscriptionParkingFilter) {
      return this.subscriptionParkingFilter;
    }
    if (this.selectedPlanForPayment && this.selectedParking) {
      return this.selectedParking;
    }
    return this.selectedSubscriptionForPayment?.parkingId;
  }

  getSubscriptionPaymentPrice(): number {
    if (this.selectedPlanForPayment) return this.selectedPlanForPayment.price;
    return this.selectedSubscriptionForPayment?.pricePaid || 0;
  }

  onSubmitSubscriptionPayment(): void {
    if (this.isBuyingSubscription || this.isConfirmingSubscription) return;

    if (this.selectedPlanForPayment) {
      this.isBuyingSubscription = true;
      this.subscriptionService.buySubscription(this.selectedPlanForPayment._id, 'card').subscribe({
        next: (res) => {
          this.isBuyingSubscription = false;
          const subscription = res.subscription;
          const subscriptionId = subscription?._id || subscription?.id;
          if (!subscriptionId) {
            this.showToast('Abonnement créé mais identifiant introuvable.', 'error');
            return;
          }
          this.confirmSubscriptionKonnect(String(subscriptionId));
        },
        error: (err) => {
          this.isBuyingSubscription = false;
          this.showToast(err.error?.message || 'Erreur lors de la souscription.', 'error');
        }
      });
      return;
    }

    if (this.selectedSubscriptionForPayment) {
      const subscriptionId = this.getSubscriptionId(this.selectedSubscriptionForPayment);
      if (!subscriptionId) {
        this.showToast('Abonnement introuvable.', 'error');
        return;
      }
      this.confirmSubscriptionKonnect(subscriptionId);
    }
  }

  private getSubscriptionId(sub: any): string | null {
    const rawId = sub?._id ?? sub?.id;
    if (!rawId) return null;
    return typeof rawId === 'object' && rawId.toString ? rawId.toString() : String(rawId);
  }

  private confirmSubscriptionKonnect(subscriptionId: string): void {
    this.isConfirmingSubscription = true;
    this.subscriptionService.confirmSubscriptionPayment(subscriptionId).subscribe({
      next: (res) => {
        const payUrl = res?.data?.payUrl || res?.payUrl;
        if (!payUrl) {
          this.isConfirmingSubscription = false;
          this.showToast('Lien de paiement introuvable. Redémarrez le backend (npm start).', 'error');
          return;
        }
        this.closeSubscriptionPaymentModal();
        window.location.assign(this.toAbsolutePayUrl(payUrl));
      },
      error: (err) => {
        this.isConfirmingSubscription = false;
        this.showToast(this.getApiErrorMessage(err, 'Erreur lors de l\'initialisation du paiement Konnect.'), 'error');
      }
    });
  }

  // Reservation Flow
  openBookingForParking(parkingId: string): void {
    const parking = this.parkings.find(p => (p.id || p._id) === parkingId);
    if (parking) {
      this.activeSection = 'parkings';
      this.startBooking(parking);
      return;
    }

    this.parkingService.getParkingLocationById(parkingId).subscribe({
      next: (res) => {
        if (res.data) {
          this.activeSection = 'parkings';
          this.startBooking(res.data);
        }
      },
      error: () => {
        this.showToast('Parking introuvable pour la réservation.', 'error');
      }
    });
  }

  startBooking(parking: any): void {
    this.selectedParkingForBooking = parking;
    this.bookingSpotId = '';
    this.bookingVehiclePlate = this.profile?.vehiclePlate || '';
    this.bookingVehicleType = this.profile?.vehicleType || 'car';
    this.bookingPaymentMethod = this.profile?.preferredPaymentMethod || 'card';
    this.bookingNotes = '';

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    this.bookingStartTime = this.formatDateTimeLocal(start);
    this.bookingEndTime = this.formatDateTimeLocal(end);

    this.isBooking = true;
    this.parkingService.getAvailableSpots(parking._id || parking.id).subscribe({
      next: (res) => {
        this.isBooking = false;
        this.bookingSpots = res.data || res.spots || [];
        if (this.bookingSpots.length > 0) {
          const preferred = this.bookingSpots.find(s => s.spotNumber === 'A01') || this.bookingSpots[0];
          this.bookingSpotId = preferred._id || preferred.id || '';
        }
      },
      error: () => {
        this.isBooking = false;
        this.showToast('Erreur lors du chargement des places disponibles.', 'error');
      }
    });
  }

  formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  onSubmitBooking(event: Event): void {
    event.preventDefault();
    if (!this.bookingVehiclePlate || !this.bookingStartTime || !this.bookingEndTime || !this.bookingSpotId) {
      this.showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    const payload = {
      parkingId: this.selectedParkingForBooking._id || this.selectedParkingForBooking.id,
      spotId: this.bookingSpotId,
      vehiclePlate: this.bookingVehiclePlate,
      vehicleType: this.bookingVehicleType,
      startTime: new Date(this.bookingStartTime).toISOString(),
      endTime: new Date(this.bookingEndTime).toISOString(),
      notes: this.bookingNotes
    };

    this.isBooking = true;
    this.reservationService.createReservation(payload).subscribe({
      next: (res) => {
        this.isBooking = false;
        const created = res.data || res;
        const reservationId = this.getReservationId(created);

        if (!reservationId) {
          this.showToast('Réservation créée mais identifiant introuvable.', 'error');
          this.loadMyReservations();
          return;
        }

        this.showToast('Réservation créée. Confirmez le paiement dans les 15 minutes.');
        this.selectedParkingForBooking = null;
        this.activeSection = 'reservations';
        this.loadMyReservations();
        this.openConfirmModal({ ...created, _id: reservationId }, this.bookingPaymentMethod);
      },
      error: (err) => {
        this.isBooking = false;
        this.showToast(this.getApiErrorMessage(err, 'Erreur lors de la réservation.'), 'error');
      }
    });
  }

  private getReservationId(reservation: any): string | null {
    if (!reservation) return null;
    const rawId = reservation._id ?? reservation.id;
    if (!rawId) return null;
    return typeof rawId === 'object' && rawId.toString ? rawId.toString() : String(rawId);
  }

  openConfirmModal(res: any, paymentMethod?: string): void {
    const reservationId = this.getReservationId(res);
    if (!reservationId) {
      this.showToast('Réservation introuvable.', 'error');
      return;
    }

    const fresh = this.myReservations.find(r => this.getReservationId(r) === reservationId) || res;
    if (fresh.status && fresh.status !== 'pending') {
      this.showToast('Cette réservation n\'est plus en attente de confirmation.', 'error');
      return;
    }

    if (this.isReservationExpired(fresh)) {
      this.showToast('Cette réservation a expiré. Veuillez en créer une nouvelle.', 'error');
      this.loadMyReservations();
      return;
    }

    this.selectedResForConfirm = { ...fresh, _id: reservationId };
    this.confirmPaymentMethod = paymentMethod || this.bookingPaymentMethod || this.profilePaymentMethod || 'card';
    this.activeSection = 'reservations';
  }

  closeConfirmModal(): void {
    this.selectedResForConfirm = null;
  }

  onSubmitConfirm(event?: Event): void {
    event?.preventDefault();
    if (!this.selectedResForConfirm || this.isConfirming) return;

    const reservationId = this.getReservationId(this.selectedResForConfirm);
    if (!reservationId) {
      this.showToast('Identifiant de réservation invalide.', 'error');
      return;
    }

    if (this.isReservationExpired(this.selectedResForConfirm)) {
      this.showToast('Cette réservation a expiré. Veuillez en créer une nouvelle.', 'error');
      this.selectedResForConfirm = null;
      this.loadMyReservations();
      return;
    }

    this.isConfirming = true;
    this.reservationService.confirmReservation(reservationId).subscribe({
      next: (res) => {
        const payUrl = res?.data?.payUrl || res?.payUrl;
        if (!payUrl) {
          this.isConfirming = false;
          this.showToast(
            'Lien de paiement introuvable. Redémarrez le backend (npm start) pour activer Konnect.',
            'error'
          );
          return;
        }
        this.selectedResForConfirm = null;
        window.location.assign(this.toAbsolutePayUrl(payUrl));
      },
      error: (err) => {
        this.isConfirming = false;
        this.showToast(this.getApiErrorMessage(err, 'Erreur lors de l\'initialisation du paiement.'), 'error');
        this.loadMyReservations();
      }
    });
  }

  private toAbsolutePayUrl(payUrl: string): string {
    if (!payUrl) return payUrl;
    if (/^https?:\/\//i.test(payUrl)) return payUrl;
    const base = environment.backendUrl || 'http://localhost:5000';
    return `${base}${payUrl.startsWith('/') ? payUrl : `/${payUrl}`}`;
  }

  getPaymentMethodLabel(_method?: string): string {
    return 'Carte bancaire (Konnect)';
  }

  isReservationExpired(reservation: any): boolean {
    if (!reservation?.autoConfirmExpiry) return false;
    return new Date(reservation.autoConfirmExpiry).getTime() <= Date.now();
  }

  getRemainingTimeLabel(reservation: any): string {
    void this.countdownTick;
    if (!reservation?.autoConfirmExpiry || reservation.status !== 'pending') return '';
    const diff = new Date(reservation.autoConfirmExpiry).getTime() - Date.now();
    if (diff <= 0) return 'Expirée';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins} min ${secs.toString().padStart(2, '0')} s`;
  }

  getPendingReservations(): any[] {
    return this.myReservations.filter(r => r.status === 'pending' && !this.isReservationExpired(r));
  }

  get pendingReservationsCount(): number {
    return this.getPendingReservations().length;
  }

  confirmReservation(id: string): void {
    const reservation = this.myReservations.find(r => this.getReservationId(r) === id);
    if (reservation) {
      this.openConfirmModal(reservation);
    }
  }

  cancelReservation(id: string): void {
    const reservationId = this.getReservationId({ _id: id }) || id;
    const reason = prompt('Veuillez saisir le motif de l\'annulation :');
    if (reason === null) return; // cancelled prompt

    this.isLoading = true;
    this.reservationService.cancelReservation(reservationId, reason).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Votre réservation a été annulée.');
        this.loadMyReservations();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de l\'annulation.', 'error');
      }
    });
  }

  openReviewModal(res: any): void {
    this.selectedResForReview = res;
    this.reviewRating = 5;
    this.reviewComment = '';
  }

  onSubmitReview(): void {
    if (!this.selectedResForReview) return;

    this.isLoading = true;
    this.reservationService.leaveReview(this.selectedResForReview._id, this.reviewRating, this.reviewComment).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Merci pour votre avis !');
        this.selectedResForReview = null;
        this.loadMyReservations();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du dépôt de l\'avis.', 'error');
      }
    });
  }

  // Profile Update
  onUpdateProfile(event: Event): void {
    event.preventDefault();

    const validationError = this.getProfileValidationError();
    if (validationError) {
      this.showToast(validationError, 'error');
      return;
    }

    const updates: any = {
      name: this.profileName.trim(),
      email: this.profileEmail.trim().toLowerCase(),
      phone: this.normalizePhone(this.profilePhone),
      cin: this.profileCin.trim().toUpperCase() || null,
      vehiclePlate: this.profilePlate.trim().toUpperCase() || null,
      vehicleSerialNumber: this.profileSerial.trim().toUpperCase() || null,
      vehicleType: this.profileVehicleType,
      preferredPaymentMethod: 'card',
      emailNotifications: this.profileEmailNotifications,
      smsNotifications: this.profileSmsNotifications
    };

    if (this.profilePassword) {
      updates.password = this.profilePassword;
    }

    this.profileSaving = true;
    this.isLoading = true;
    this.userService.updateMe(updates).subscribe({
      next: (res) => {
        this.profileSaving = false;
        this.isLoading = false;
        this.profile = res.user;
        this.profilePassword = '';
        this.profilePasswordConfirm = '';
        this.authService.updateCurrentUserValue({
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone
        });
        this.showToast('Votre profil a été mis à jour avec succès.');
      },
      error: (err) => {
        this.profileSaving = false;
        this.isLoading = false;
        this.showToast(this.getApiErrorMessage(err, 'Erreur lors de la mise à jour.'), 'error');
      }
    });
  }

  resetProfileForm(): void {
    if (!this.profile) {
      this.loadProfile();
      return;
    }

    this.profileName = this.profile.name || '';
    this.profileEmail = this.profile.email || '';
    this.profilePhone = this.profile.phone || '';
    this.profileCin = this.profile.cin || '';
    this.profilePlate = this.profile.vehiclePlate || '';
    this.profileSerial = this.profile.vehicleSerialNumber || '';
    this.profileVehicleType = this.profile.vehicleType || 'car';
    this.profilePaymentMethod = this.profile.preferredPaymentMethod || 'card';
    this.profileEmailNotifications = this.profile.emailNotifications !== false;
    this.profileSmsNotifications = this.profile.smsNotifications === true;
    this.profilePassword = '';
    this.profilePasswordConfirm = '';
  }

  loadMyComplaints(): void {
    this.complaintService.getMyComplaints().subscribe({
      next: (res) => {
        this.myComplaints = res.data || [];
      },
      error: () => {
        this.myComplaints = [];
      }
    });
  }

  getComplaintReservationsForParking(): any[] {
    if (!this.complaintParkingId) return [];
    return this.myReservations.filter((r) => {
      const pid = r.parkingId?._id || r.parkingId?.id || r.parkingId;
      return String(pid) === String(this.complaintParkingId);
    });
  }

  submitComplaint(event: Event): void {
    event.preventDefault();
    if (!this.complaintParkingId || !this.complaintSubject.trim() || !this.complaintDescription.trim()) {
      this.showToast('Veuillez remplir le parking, le sujet et la description.', 'error');
      return;
    }

    this.complaintSubmitting = true;
    const payload: any = {
      parkingId: this.complaintParkingId,
      subject: this.complaintSubject.trim(),
      category: this.complaintCategory,
      description: this.complaintDescription.trim(),
      priority: this.complaintPriority
    };
    if (this.complaintReservationId) {
      payload.reservationId = this.complaintReservationId;
    }

    this.complaintService.createComplaint(payload).subscribe({
      next: () => {
        this.complaintSubmitting = false;
        this.complaintSubject = '';
        this.complaintDescription = '';
        this.complaintReservationId = '';
        this.complaintCategory = 'other';
        this.complaintPriority = 'medium';
        this.showToast('Réclamation envoyée. L\'entreprise vous répondra sous peu.');
        this.loadMyComplaints();
      },
      error: (err) => {
        this.complaintSubmitting = false;
        this.showToast(this.getApiErrorMessage(err, 'Erreur lors de l\'envoi de la réclamation.'), 'error');
      }
    });
  }

  openComplaintDetail(complaint: any): void {
    this.selectedComplaint = complaint;
  }

  closeComplaintDetail(): void {
    this.selectedComplaint = null;
  }

  escalateMyComplaint(complaint: any): void {
    const id = complaint._id || complaint.id;
    this.complaintService.escalateComplaint(id).subscribe({
      next: () => {
        this.showToast('Réclamation escaladée vers l\'administrateur.');
        this.loadMyComplaints();
        this.closeComplaintDetail();
      },
      error: (err) => {
        this.showToast(this.getApiErrorMessage(err, 'Impossible d\'escalader.'), 'error');
      }
    });
  }

  closeMyComplaint(complaint: any): void {
    const id = complaint._id || complaint.id;
    this.complaintService.closeComplaint(id).subscribe({
      next: () => {
        this.showToast('Réclamation clôturée.');
        this.loadMyComplaints();
        this.closeComplaintDetail();
      },
      error: (err) => {
        this.showToast(this.getApiErrorMessage(err, 'Impossible de clôturer.'), 'error');
      }
    });
  }

  getComplaintStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente',
      in_progress: 'En cours',
      resolved: 'Résolue',
      closed: 'Clôturée',
      rejected: 'Rejetée',
      escalated: 'Escaladée'
    };
    return map[status] || status;
  }

  getComplaintCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      parking: 'Parking',
      reservation: 'Réservation',
      payment: 'Paiement',
      subscription: 'Abonnement',
      access: 'Accès',
      staff: 'Personnel',
      other: 'Autre'
    };
    return map[category] || category;
  }

  private getSecurityErrorMessage(err: any, fallback: string): string {
    if (err?.status === 0) {
      return 'Impossible de joindre le serveur. Redémarrez le backend (npm start).';
    }
    if (err?.status === 404) {
      return 'Routes de sécurité introuvables. Redémarrez le backend après la mise à jour.';
    }
    return err?.error?.message || err?.message || fallback;
  }

  async registerPasskey(): Promise<void> {
    if (!this.passkeySupported) {
      this.showToast('WebAuthn non supporté sur ce navigateur', 'error');
      return;
    }
    this.securityLoading = true;
    try {
      await this.webauthnService.registerPasskey('Passkey Apex');
      this.showToast('Passkey enregistrée avec succès !');
      this.loadProfile();
    } catch (err: any) {
      this.showToast(this.getSecurityErrorMessage(err, 'Échec de l\'enregistrement de la passkey'), 'error');
    } finally {
      this.securityLoading = false;
    }
  }

  async startFaceEnrollCamera(): Promise<void> {
    const video = this.enrollVideoRef?.nativeElement;
    if (!video) return;
    try {
      await this.faceAuthService.startCamera(video);
      this.faceEnrollCameraActive = true;
    } catch {
      this.showToast('Impossible d\'accéder à la caméra', 'error');
    }
  }

  stopFaceEnrollCamera(): void {
    this.faceAuthService.stopCamera();
    this.faceEnrollCameraActive = false;
  }

  enrollFace(): void {
    const video = this.enrollVideoRef?.nativeElement;
    if (!video || !this.faceEnrollCameraActive) {
      this.showToast('Activez la caméra avant l\'enregistrement', 'error');
      return;
    }
    this.securityLoading = true;
    try {
      const image = this.faceAuthService.captureFrame(video);
      this.faceAuthService.enrollFace(image).subscribe({
        next: () => {
          this.securityLoading = false;
          this.showToast('Reconnaissance faciale activée !');
          this.stopFaceEnrollCamera();
          this.loadProfile();
        },
        error: (err) => {
          this.securityLoading = false;
          this.showToast(this.getSecurityErrorMessage(err, 'Échec de l\'enregistrement du visage'), 'error');
        }
      });
    } catch (err: any) {
      this.securityLoading = false;
      this.showToast(err.message || 'Erreur de capture', 'error');
    }
  }

  removeFaceEnrollment(): void {
    this.securityLoading = true;
    this.faceAuthService.removeEnrollment().subscribe({
      next: () => {
        this.securityLoading = false;
        this.showToast('Reconnaissance faciale désactivée.');
        this.loadProfile();
      },
      error: (err) => {
        this.securityLoading = false;
        this.showToast(err.error?.message || 'Erreur', 'error');
      }
    });
  }
}
