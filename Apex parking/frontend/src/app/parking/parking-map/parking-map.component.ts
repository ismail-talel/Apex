import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { ParkingService } from '../../core/services/parking.service';
import { MapService } from '../../core/services/map.service';
import { LocationService } from '../../core/services/location.service';
import { ParkingLocation } from '../models/parking.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-parking-map',
  templateUrl: './parking-map.component.html',
  styleUrls: ['./parking-map.component.css']
})
export class ParkingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  // Données
  parkings: ParkingLocation[] = [];
  selectedParking: ParkingLocation | null = null;
  isLoading = false;
  errorMessage = '';

  // Position utilisateur
  userLat: number | null = null;
  userLng: number | null = null;
  userAccuracy: number | null = null;
  hasUserLocation = false;
  isTrackingLocation = false;
  locationError = '';
  locationWarning = '';

  // Abonnements
  private subscriptions: Subscription[] = [];
  private mapReady = false;

  constructor(
    private parkingService: ParkingService,
    private mapService: MapService,
    private locationService: LocationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadParkings();
    this.startLocationTracking();
    this.subscribeToParkingSelection();
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.mapReady = true;
    if (this.parkings.length) {
      this.addMarkersToMap(false);
      this.updateMapView();
    }
    if (this.userLat !== null && this.userLng !== null) {
      this.mapService.updateUserLocation(this.userLat, this.userLng, this.userAccuracy ?? undefined);
      this.updateMapView(true);
    }
    setTimeout(() => this.mapService.refresh(), 200);
    setTimeout(() => this.mapService.refresh(), 600);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.locationService.stopWatching();
    this.mapService.destroyMap();
  }

  /**
   * Initialiser la carte
   */
  private initMap(): void {
    if (this.userLat && this.userLng) {
      this.mapService.initMap(this.mapContainer, [this.userLat, this.userLng]);
    } else {
      this.mapService.initMap(this.mapContainer);
    }
  }

  /**
   * Charger les parkings
   */
  loadParkings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.parkingService.getParkingLocations().subscribe({
      next: (response) => {
        if (response.success === false) {
          this.errorMessage = response.error || response.message || 'Impossible de charger les parkings';
          this.parkings = [];
          this.isLoading = false;
          return;
        }
        this.parkings = response.data || [];
        if (this.mapReady) {
          this.addMarkersToMap(false);
          this.updateMapView();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorMessage = 'Impossible de charger les parkings';
        this.isLoading = false;
      }
    });
  }

  /**
   * Ajouter les marqueurs sur la carte
   */
  private addMarkersToMap(fitView = true): void {
    this.mapService.addParkingMarkers(this.parkings, (parking) => {
      this.selectedParking = parking;
    }, { fitView });
  }

  /**
   * Adapter la vue carte
   */
  private updateMapView(centerOnUser = false): void {
    if (!this.mapReady) return;

    if (this.hasUserLocation && this.userLat !== null && this.userLng !== null) {
      this.mapService.updateUserLocation(this.userLat, this.userLng, this.userAccuracy ?? undefined);
    }

    if (centerOnUser && this.hasUserLocation && this.userLat !== null && this.userLng !== null) {
      this.mapService.centerOnUser(this.userLat, this.userLng, 15);
      return;
    }

    if (this.parkings.length > 0) {
      this.mapService.fitToMarkers(this.hasUserLocation);
      return;
    }

    if (this.hasUserLocation && this.userLat !== null && this.userLng !== null) {
      this.mapService.centerOnUser(this.userLat, this.userLng, 14);
    }
  }

  private applyUserLocation(location: { latitude: number; longitude: number; accuracy?: number }): void {
    if (!this.locationService.isInTunisiaBounds(location.latitude, location.longitude)) {
      this.hasUserLocation = false;
      this.userLat = null;
      this.userLng = null;
      this.userAccuracy = null;
      this.locationWarning = '';
      this.locationError = 'Position incorrecte (hors Tunisie). Sur ordinateur, activez le GPS ou utilisez un téléphone. La carte reste centrée sur Tunis.';
      if (this.mapReady) {
        this.mapService.removeUserLocation();
        const tunis = this.locationService.getTunisCenter();
        this.mapService.flyTo(tunis.latitude, tunis.longitude, 12);
      }
      return;
    }

    this.userLat = location.latitude;
    this.userLng = location.longitude;
    this.userAccuracy = location.accuracy ?? null;
    this.hasUserLocation = true;
    this.locationError = '';

    if (location.accuracy && !this.locationService.isAccurateEnough(location.accuracy, 1500)) {
      this.locationWarning = `Position approximative (± ${location.accuracy < 1000
        ? Math.round(location.accuracy) + ' m'
        : (location.accuracy / 1000).toFixed(1) + ' km'}). Sur mobile avec GPS activé, la précision sera meilleure.`;
    } else {
      this.locationWarning = '';
    }

    if (this.mapReady) {
      this.mapService.updateUserLocation(location.latitude, location.longitude, location.accuracy);
      this.mapService.refresh();
    }
  }

  /**
   * S'abonner à la sélection d'un parking
   */
  private subscribeToParkingSelection(): void {
    const sub = this.mapService.selectedParking$.subscribe((parking) => {
      this.selectedParking = parking;
      if (parking) {
        setTimeout(() => this.mapService.refresh(), 350);
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Démarrer le suivi de position en temps réel
   */
  private startLocationTracking(): void {
    if (!this.locationService.isGeolocationSupported()) {
      this.locationError = 'Géolocalisation non supportée par votre navigateur';
      return;
    }

    this.isTrackingLocation = true;

    const locationSub = this.locationService.getLocationObservable().subscribe((location) => {
      if (!location) return;
      this.applyUserLocation(location);
    });
    this.subscriptions.push(locationSub);

    this.locationService.getCurrentPosition().then((location) => {
      this.applyUserLocation(location);
      this.locationService.startWatching();
    }).catch((error) => {
      this.isTrackingLocation = false;
      const tunis = this.locationService.getTunisCenter();
      if (this.mapReady) {
        this.mapService.flyTo(tunis.latitude, tunis.longitude, 12);
      }
      this.locationError = error?.message === 'Position hors de la Tunisie'
        ? 'Géolocalisation imprécise (position détectée hors Tunisie). Utilisez un smartphone avec GPS ou consultez les parkings sur la carte.'
        : (error?.code !== undefined
          ? this.getLocationErrorMessage(error)
          : 'Impossible d\'obtenir votre position. La carte affiche les parkings en Tunisie.');
      console.warn('Géolocalisation non disponible:', error);
    });
  }

  /**
   * Centrer la carte sur la position de l'utilisateur
   */
  centerOnUserLocation(): void {
    if (!this.locationService.isGeolocationSupported()) {
      this.locationError = 'Géolocalisation non supportée par votre navigateur';
      return;
    }

    this.locationError = '';
    this.locationService.getCurrentPosition().then((location) => {
      this.applyUserLocation(location);

      if (this.mapReady) {
        this.mapService.centerOnUser(location.latitude, location.longitude, 16);
      }
    }).catch((error) => {
      this.locationError = error?.message === 'Position hors de la Tunisie'
        ? 'Position détectée hors Tunisie. Vérifiez le GPS ou utilisez un téléphone.'
        : (error?.code !== undefined
          ? this.getLocationErrorMessage(error)
          : 'Impossible d\'obtenir votre position.');
      if (!this.userLat || !this.userLng) {
        this.startLocationTracking();
      }
    });
  }

  /**
   * Message d'erreur géolocalisation
   */
  private getLocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Accès à la localisation refusé. Activez-la dans les paramètres du navigateur.';
      case error.POSITION_UNAVAILABLE:
        return 'Position indisponible.';
      case error.TIMEOUT:
        return 'Délai de géolocalisation dépassé.';
      default:
        return 'Impossible d\'obtenir votre position.';
    }
  }

  /**
   * Rechercher les parkings à proximité
   */
  findNearbyParkings(): void {
    if (!this.userLat || !this.userLng) {
      this.errorMessage = 'Position utilisateur non disponible';
      this.centerOnUserLocation();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.parkingService.getNearbyParkings(this.userLat, this.userLng, 5000).subscribe({
      next: (response) => {
        this.parkings = response.data || [];
        if (this.mapReady) {
          this.addMarkersToMap(false);
          this.mapService.updateUserLocation(this.userLat!, this.userLng!, this.userAccuracy ?? undefined);
          this.updateMapView(true);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorMessage = 'Erreur lors de la recherche à proximité';
        this.isLoading = false;
      }
    });
  }

  /**
   * Centrer la carte sur un parking
   */
  centerOnParking(parking: ParkingLocation): void {
    this.mapService.flyTo(parking.lat, parking.lng);
    this.mapService.highlightParking(parking);
  }

  /**
   * Ouvrir la simulation du parking
   */
  openSimulator(parkingId: string): void {
    this.router.navigate(['/parking', parkingId, 'simulator']);
  }

  /**
   * Naviguer vers les détails du parking
   */
  navigateToParkingDetails(parkingId: string): void {
    this.router.navigate(['/parking', parkingId]);
  }

  /**
   * Rafraîchir la carte
   */
  refreshMap(): void {
    this.loadParkings();
    this.mapService.refresh();
  }

  /**
   * Fermer les détails
   */
  closeDetails(): void {
    this.selectedParking = null;
    this.mapService.closePopup();
    setTimeout(() => this.mapService.refresh(), 300);
  }

  /**
   * Méthodes utilitaires pour le template
   */
  getAvailabilityColor(parking: ParkingLocation): string {
    if (!this.isParkingOpen(parking)) return '#6c757d';
    const ratio = parking.availableSpots / parking.totalSpots;
    if (ratio > 0.3) return '#28a745';
    if (ratio > 0.1) return '#ffc107';
    return '#dc3545';
  }

  getAvailabilityText(parking: ParkingLocation): string {
    if (!this.isParkingOpen(parking)) return 'Fermé';
    const ratio = parking.availableSpots / parking.totalSpots;
    if (ratio > 0.3) return 'Disponible';
    if (ratio > 0.1) return 'Places limitées';
    return 'Complet';
  }

  isParkingOpen(parking: ParkingLocation): boolean {
    if (parking.isOpen24h) return true;
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    if (!parking.openingTime || !parking.closingTime) return false;
    const [openHour, openMinute] = parking.openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = parking.closingTime.split(':').map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    return currentTime >= openTime && currentTime <= closeTime;
  }

  formatPrice(price: number): string {
    return `${price.toFixed(2)} DT/h`;
  }

  formatRating(rating: number): string {
    return rating ? `${rating.toFixed(1)}/5` : 'Non noté';
  }

  getTotalAvailableSpots(): number {
    return this.parkings.reduce((sum, p) => sum + (p.availableSpots || 0), 0);
  }

  getOccupancyPercent(parking: ParkingLocation): number {
    if (!parking.totalSpots) return 0;
    return Math.round((parking.availableSpots / parking.totalSpots) * 100);
  }
}