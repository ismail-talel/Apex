import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { ParkingService } from '../../core/services/parking.service';
import { ParkingLocation } from '../models/parking.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-parking-details',
  templateUrl: './parking-details.component.html',
  styleUrls: ['./parking-details.component.css']
})
export class ParkingDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('miniMapContainer') miniMapContainer!: ElementRef;

  parking: ParkingLocation | null = null;
  parkingId = '';
  isLoading = true;
  errorMessage = '';
  isOpen = false;
  mapReady = false;

  private subscriptions: Subscription[] = [];
  private miniMap: L.Map | null = null;
  private miniMapMarker: L.CircleMarker | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private parkingService: ParkingService
  ) {}

  ngOnInit(): void {
    this.parkingId = this.route.snapshot.paramMap.get('id') || '';
    if (this.parkingId) {
      this.loadParkingDetails(this.parkingId);
    } else {
      this.errorMessage = 'Parking introuvable.';
      this.isLoading = false;
    }
  }

  ngAfterViewInit(): void {
    this.mapReady = true;
    if (this.parking) {
      this.initMiniMap();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.destroyMiniMap();
  }

  loadParkingDetails(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    const sub = this.parkingService.getParkingById(id).subscribe({
      next: (response) => {
        this.parking = response.data;
        this.isLoading = false;
        this.checkIfOpen();
        if (this.mapReady && this.parking) {
          setTimeout(() => this.initMiniMap(), 100);
        }
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les détails du parking.';
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  checkIfOpen(): void {
    if (!this.parking) return;

    const sub = this.parkingService.isParkingOpen(this.parking.id).subscribe({
      next: (response) => {
        this.isOpen = response.data.isOpen;
      },
      error: () => {
        this.isOpen = this.isParkingOpenLocally();
      }
    });

    this.subscriptions.push(sub);
  }

  private isParkingOpenLocally(): boolean {
    if (!this.parking) return false;
    if (this.parking.isOpen24h) return true;
    if (!this.parking.openingTime || !this.parking.closingTime) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMinute] = this.parking.openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = this.parking.closingTime.split(':').map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    return currentTime >= openTime && currentTime <= closeTime;
  }

  private initMiniMap(): void {
    if (!this.parking || !this.miniMapContainer) return;

    this.destroyMiniMap();

    this.miniMap = L.map(this.miniMapContainer.nativeElement, {
      center: [this.parking.lat, this.parking.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.miniMap);

    this.miniMapMarker = L.circleMarker([this.parking.lat, this.parking.lng], {
      radius: 10,
      color: '#ffffff',
      weight: 3,
      fillColor: this.getStatusColor(),
      fillOpacity: 1
    }).addTo(this.miniMap);

    this.miniMapMarker.bindPopup(`<strong>${this.parking.name}</strong>`);

    setTimeout(() => this.miniMap?.invalidateSize(), 150);
  }

  private destroyMiniMap(): void {
    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
      this.miniMapMarker = null;
    }
  }

  goBack(): void {
    this.router.navigate(['/map']);
  }

  openSimulator(): void {
    if (this.parking?.id) {
      this.router.navigate(['/parking', this.parking.id, 'simulator']);
    }
  }

  reserveParking(): void {
    if (!this.parking?.id) return;
    this.router.navigate(['/client'], {
      queryParams: { section: 'parkings', book: this.parking.id }
    });
  }

  openInMaps(): void {
    if (!this.parking) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${this.parking.lat},${this.parking.lng}`;
    window.open(url, '_blank');
  }

  getStatusColor(): string {
    if (!this.parking) return '#6b7280';
    if (!this.isOpen) return '#ef4444';
    const ratio = this.parking.availableSpots / this.parking.totalSpots;
    if (ratio > 0.3) return '#10b981';
    if (ratio > 0.1) return '#f59e0b';
    return '#ef4444';
  }

  getStatusText(): string {
    if (!this.parking) return 'Indisponible';
    if (!this.isOpen) return 'Fermé';
    const ratio = this.parking.availableSpots / this.parking.totalSpots;
    if (ratio > 0.3) return 'Disponible';
    if (ratio > 0.1) return 'Places limitées';
    return 'Complet';
  }

  getAvailabilityPercent(): number {
    if (!this.parking?.totalSpots) return 0;
    return Math.round((this.parking.availableSpots / this.parking.totalSpots) * 100);
  }

  getOccupiedPercent(): number {
    return 100 - this.getAvailabilityPercent();
  }

  formatPrice(price: number): string {
    return `${price.toFixed(2)} DT/h`;
  }

  formatRating(rating: number): string {
    return rating ? rating.toFixed(1) : '—';
  }

  getScheduleText(): string {
    if (!this.parking) return '—';
    if (this.parking.isOpen24h) return 'Ouvert 24h/24';
    return `${this.parking.openingTime} – ${this.parking.closingTime}`;
  }

  retryLoad(): void {
    if (this.parkingId) {
      this.loadParkingDetails(this.parkingId);
    }
  }
}
