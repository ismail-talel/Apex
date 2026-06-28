import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserLocation } from '../../parking/models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private locationSubject = new BehaviorSubject<UserLocation | null>(null);
  private watchId: number | null = null;
  private isWatching = false;

  constructor(private ngZone: NgZone) {}

  private normalizeCoordinates(latitude: number, longitude: number): { latitude: number; longitude: number } {
    let lat = latitude;
    let lng = longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Coordonnées invalides');
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      [lat, lng] = [lng, lat];
    }

    // Corrige lat/lng inversés (fréquent en Tunisie : lat ~33-37, lng ~7-12)
    if (lat >= 7 && lat <= 14 && lng >= 30 && lng <= 40) {
      [lat, lng] = [lng, lat];
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error('Coordonnées hors limites');
    }

    return { latitude: lat, longitude: lng };
  }

  /** Zone approximative Tunisie (avec marge côtière) */
  isInTunisiaBounds(latitude: number, longitude: number): boolean {
    return latitude >= 30 && latitude <= 38 && longitude >= 7 && longitude <= 12.5;
  }

  getTunisCenter(): { latitude: number; longitude: number } {
    return { latitude: 36.8065, longitude: 10.1815 };
  }

  isAccurateEnough(accuracy?: number, maxMeters = 5000): boolean {
    return !accuracy || accuracy <= maxMeters;
  }

  private toUserLocation(position: GeolocationPosition): UserLocation {
    const { latitude, longitude } = this.normalizeCoordinates(
      position.coords.latitude,
      position.coords.longitude
    );

    if (!this.isInTunisiaBounds(latitude, longitude)) {
      throw new Error('Position hors de la Tunisie');
    }

    return {
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
  }

  getCurrentPosition(options?: PositionOptions): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      const tryPosition = (highAccuracy: boolean) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            try {
              const location = this.toUserLocation(position);
              this.locationSubject.next(location);
              resolve(location);
            } catch (error) {
              if (highAccuracy) {
                tryPosition(false);
              } else {
                reject(error);
              }
            }
          },
          (error) => {
            if (highAccuracy) {
              tryPosition(false);
            } else {
              reject(error);
            }
          },
          options || {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 20000 : 15000,
            maximumAge: 0
          }
        );
      };

      tryPosition(true);
    });
  }

  startWatching(options?: PositionOptions): void {
    if (!navigator.geolocation || this.isWatching) return;

    this.isWatching = true;
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.ngZone.run(() => {
          try {
            const location = this.toUserLocation(position);
            this.locationSubject.next(location);
          } catch (error) {
            console.warn('Position ignorée (hors Tunisie ou invalide):', error);
          }
        });
      },
      (error) => {
        console.error('Erreur de suivi:', error);
        this.isWatching = false;
      },
      options || {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isWatching = false;
    }
  }

  getLocationObservable(): Observable<UserLocation | null> {
    return this.locationSubject.asObservable();
  }

  getLastKnownLocation(): UserLocation | null {
    return this.locationSubject.value;
  }

  isGeolocationSupported(): boolean {
    return !!navigator.geolocation;
  }

  isLocationWatching(): boolean {
    return this.isWatching;
  }
}
