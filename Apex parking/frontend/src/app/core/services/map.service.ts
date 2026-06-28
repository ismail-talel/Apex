import { Injectable, ElementRef } from '@angular/core';
import * as L from 'leaflet';
import { ParkingLocation } from '../../parking/models/parking.model';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private selectedMarker: L.Marker | null = null;
  private userMarker: L.CircleMarker | null = null;
  private userAccuracyCircle: L.Circle | null = null;

  private selectedParkingSubject = new Subject<ParkingLocation>();
  selectedParking$ = this.selectedParkingSubject.asObservable();

  private readonly TUNIS_LAT = 36.8065;
  private readonly TUNIS_LNG = 10.1815;
  private readonly DEFAULT_ZOOM = 13;

  initMap(container: ElementRef, center: [number, number] = [this.TUNIS_LAT, this.TUNIS_LNG], zoom: number = this.DEFAULT_ZOOM): void {
    this.map = L.map(container.nativeElement, {
      center,
      zoom,
      zoomControl: false,
      fadeAnimation: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ position: 'bottomleft', metric: true }).addTo(this.map);

    this.map.on('click', () => this.closePopup());

    setTimeout(() => {
      this.map.invalidateSize();
    }, 150);
  }

  flyToTunis(zoom: number = this.DEFAULT_ZOOM): void {
    if (this.map) {
      this.map.flyTo([this.TUNIS_LAT, this.TUNIS_LNG], zoom);
    }
  }

  addParkingMarkers(
    parkings: ParkingLocation[],
    onMarkerClick?: (parking: ParkingLocation) => void,
    options: { fitView?: boolean } = {}
  ): void {
    if (!this.map) return;

    const fitView = options.fitView !== false;

    this.clearMarkers();

    parkings.forEach(parking => {
      const marker = this.createMarker(parking);
      marker.addTo(this.map);

      marker.on('click', () => {
        this.selectedMarker = marker;
        this.selectedParkingSubject.next(parking);
        onMarkerClick?.(parking);
      });

      marker.bindPopup(this.createPopupContent(parking), {
        maxWidth: 300,
        className: 'parking-popup'
      });

      this.markers.push(marker);
    });

    if (fitView && this.markers.length > 0) {
      this.fitToMarkers();
    }
  }

  fitToMarkers(includeUser = false): void {
    if (!this.map) return;

    try {
      const layers: L.Layer[] = [...this.markers];
      if (includeUser && this.userMarker) {
        layers.push(this.userMarker);
      }
      if (includeUser && this.userAccuracyCircle) {
        layers.push(this.userAccuracyCircle);
      }
      if (layers.length === 0) return;

      const group = L.featureGroup(layers);
      this.map.fitBounds(group.getBounds().pad(0.15));
      setTimeout(() => this.map.invalidateSize(), 100);
    } catch (error) {
      console.warn('Impossible d\'adapter la vue aux marqueurs:', error);
    }
  }

  private createMarker(parking: ParkingLocation): L.Marker {
    const isOpen = this.isParkingOpen(parking);
    let color = '#6c757d';

    if (isOpen) {
      const ratio = parking.availableSpots / parking.totalSpots;
      if (ratio > 0.3) color = '#28a745';
      else if (ratio > 0.1) color = '#ffc107';
      else color = '#dc3545';
    }

    const icon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-container">
          <div class="marker-pin" style="background: ${color}">
            <span class="marker-spots">${parking.availableSpots}</span>
          </div>
          <div class="marker-label">${this.truncateText(parking.name, 12)}</div>
        </div>
      `,
      iconSize: [60, 50],
      iconAnchor: [30, 18],
      popupAnchor: [0, -18]
    });

    return L.marker([parking.lat, parking.lng], { icon });
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private createPopupContent(parking: ParkingLocation): string {
    const isOpen = this.isParkingOpen(parking);
    const statusColor = isOpen ? '#28a745' : '#dc3545';
    const statusText = isOpen ? 'Ouvert' : 'Fermé';
    const availability = parking.availableSpots > 0
      ? `${parking.availableSpots} places disponibles`
      : 'Complet';

    return `
      <div class="popup-content">
        <div class="popup-header">
          <h3>${parking.name}</h3>
          <span class="popup-status" style="background: ${statusColor}">${statusText}</span>
        </div>
        <div class="popup-body">
          <p><strong>Adresse :</strong> ${parking.address}</p>
          <p><strong>Ville :</strong> ${parking.city}</p>
          <p><strong>Places :</strong> ${availability} (${parking.availableSpots} / ${parking.totalSpots})</p>
          <p><strong>Tarif :</strong> ${parking.pricePerHour} DT/h</p>
          <button class="popup-btn" onclick="window.location.href='/parking/${parking.id}'">
            Voir détails
          </button>
        </div>
      </div>
    `;
  }

  private formatRating(rating: number): string {
    if (!rating) return 'Non noté';
    const stars = '⭐'.repeat(Math.round(rating));
    return `${stars} ${rating.toFixed(1)}/5`;
  }

  private isParkingOpen(parking: ParkingLocation): boolean {
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

  highlightParking(parking: ParkingLocation): void {
    const marker = this.markers.find(m => {
      const latLng = m.getLatLng();
      return latLng.lat === parking.lat && latLng.lng === parking.lng;
    });

    if (marker) {
      this.selectedMarker = marker;
      marker.openPopup();
      this.map.flyTo(marker.getLatLng(), 16);
    }
  }

  updateUserLocation(lat: number, lng: number, accuracy?: number): void {
    if (!this.map) return;

    const position = L.latLng(lat, lng);

    if (this.userAccuracyCircle) {
      this.map.removeLayer(this.userAccuracyCircle);
      this.userAccuracyCircle = null;
    }

    if (accuracy && accuracy > 0) {
      this.userAccuracyCircle = L.circle(position, {
        radius: accuracy,
        color: '#1a73e8',
        fillColor: '#1a73e8',
        fillOpacity: 0.12,
        weight: 1
      }).addTo(this.map);
    }

    if (this.userMarker) {
      this.userMarker.setLatLng(position);
    } else {
      this.userMarker = L.circleMarker(position, {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1a73e8',
        fillOpacity: 1,
        pane: 'markerPane',
        className: 'user-position-marker'
      }).addTo(this.map);

      this.userMarker.bindPopup(this.createUserPopupContent(lat, lng, accuracy));
    }

    this.userMarker.setPopupContent(this.createUserPopupContent(lat, lng, accuracy));
    this.userMarker.bringToFront();

    setTimeout(() => this.map.invalidateSize(), 50);
  }

  private createUserPopupContent(lat: number, lng: number, accuracy?: number): string {
    const accuracyText = accuracy
      ? (accuracy < 1000 ? `± ${Math.round(accuracy)} m` : `± ${(accuracy / 1000).toFixed(1)} km`)
      : 'Précision inconnue';

    return `
      <div class="user-popup">
        <strong>Votre position</strong>
        <p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
        <p class="user-popup-accuracy">${accuracyText}</p>
      </div>
    `;
  }

  removeUserLocation(): void {
    if (this.userMarker && this.map) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    if (this.userAccuracyCircle && this.map) {
      this.map.removeLayer(this.userAccuracyCircle);
      this.userAccuracyCircle = null;
    }
  }

  centerOnUser(lat: number, lng: number, zoom: number = 16): void {
    if (!this.map) return;
    this.updateUserLocation(lat, lng);
    this.map.flyTo([lat, lng], zoom, { duration: 0.8 });
    setTimeout(() => {
      this.map.invalidateSize();
      this.userMarker?.openPopup();
    }, 300);
  }

  flyTo(lat: number, lng: number, zoom: number = 15): void {
    if (this.map) {
      this.map.flyTo([lat, lng], zoom);
    }
  }

  closePopup(): void {
    if (this.map) {
      this.map.closePopup();
    }
    this.selectedMarker = null;
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
  }

  destroyMap(): void {
    this.removeUserLocation();
    if (this.map) {
      this.map.remove();
    }
  }

  refresh(): void {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  getMap(): L.Map | null {
    return this.map;
  }

  getTunisCoordinates(): { lat: number; lng: number } {
    return { lat: this.TUNIS_LAT, lng: this.TUNIS_LNG };
  }
}
