import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import {
  ParkingSpot,
  SpotStats,
  SimulationUpdate,
  SpotFilters,
  GenerateSpotsConfig,
  ApiResponse,
  ParkingOrganization,
  SPOT_CONSTANTS
} from '../../parking/models/parking-spot.models';

export * from '../../parking/models/parking-spot.models';

@Injectable({
  providedIn: 'root'
})
export class ParkingSpotService implements OnDestroy {
  private readonly API = `${environment.apiUrl}/parking`;
  private readonly WS = environment.wsUrl;

  private socket: Socket | null = null;
  private simulationUpdate$ = new Subject<SimulationUpdate>();
  private currentParkingId: string | null = null;
  private spotsSubject = new BehaviorSubject<ParkingSpot[]>([]);
  private statsSubject = new BehaviorSubject<SpotStats | null>(null);
  private isSimulatingSubject = new BehaviorSubject<boolean>(false);
  private lastUpdateSubject = new BehaviorSubject<Date | null>(null);
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  spots$ = this.spotsSubject.asObservable();
  stats$ = this.statsSubject.asObservable();
  isSimulating$ = this.isSimulatingSubject.asObservable();
  lastUpdate$ = this.lastUpdateSubject.asObservable();
  connected$ = this.connectedSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  get spots(): ParkingSpot[] {
    return this.spotsSubject.getValue();
  }

  get stats(): SpotStats | null {
    return this.statsSubject.getValue();
  }

  get isSimulating(): boolean {
    return this.isSimulatingSubject.getValue();
  }

  get isConnected(): boolean {
    return this.connectedSubject.getValue();
  }

  get currentParking(): string | null {
    return this.currentParkingId;
  }

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getSpotsByParking(
    parkingId: string,
    filters: SpotFilters = {}
  ): Observable<ApiResponse<ParkingSpot[]>> {
    this.loadingSubject.next(true);
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
      )
    ).toString();

    const url = `${this.API}/${parkingId}/spots${params ? '?' + params : ''}`;

    return new Observable<ApiResponse<ParkingSpot[]>>(observer => {
      this.http.get<ApiResponse<ParkingSpot[]>>(url).subscribe({
        next: (response) => {
          this.loadingSubject.next(false);
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          this.loadingSubject.next(false);
          observer.error(error);
        }
      });
    });
  }

  getAvailableSpots(parkingId: string): Observable<ApiResponse<ParkingSpot[]>> {
    this.loadingSubject.next(true);
    return new Observable<ApiResponse<ParkingSpot[]>>(observer => {
      this.http.get<ApiResponse<ParkingSpot[]>>(
        `${this.API}/${parkingId}/spots/available`
      ).subscribe({
        next: (response) => {
          this.loadingSubject.next(false);
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          this.loadingSubject.next(false);
          observer.error(error);
        }
      });
    });
  }

  getSpotStats(parkingId: string): Observable<ApiResponse<SpotStats>> {
    this.loadingSubject.next(true);
    return new Observable<ApiResponse<SpotStats>>(observer => {
      this.http.get<ApiResponse<SpotStats>>(
        `${this.API}/${parkingId}/spots/stats`
      ).subscribe({
        next: (response) => {
          this.loadingSubject.next(false);
          if (response.success && response.data) {
            this.statsSubject.next(response.data);
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          this.loadingSubject.next(false);
          observer.error(error);
        }
      });
    });
  }

  getParkingOrganization(parkingId: string): Observable<ApiResponse<ParkingOrganization>> {
    return this.http.get<ApiResponse<ParkingOrganization>>(
      `${this.API}/${parkingId}/spots/organization`
    );
  }

  getSpotById(spotId: string): Observable<ApiResponse<ParkingSpot>> {
    return this.http.get<ApiResponse<ParkingSpot>>(`${this.API}/spots/${spotId}`);
  }

  updateSpotStatus(
    spotId: string,
    data: Partial<ParkingSpot>
  ): Observable<ApiResponse<ParkingSpot>> {
    return this.http.put<ApiResponse<ParkingSpot>>(
      `${this.API}/spots/${spotId}/status`,
      data,
      { headers: this.authHeaders() }
    );
  }

  generateSpots(
    parkingId: string,
    config: GenerateSpotsConfig = {}
  ): Observable<ApiResponse<ParkingSpot[]>> {
    const payload = {
      ...SPOT_CONSTANTS.DEFAULT_CONFIG,
      ...config
    };

    return this.http.post<ApiResponse<ParkingSpot[]>>(
      `${this.API}/${parkingId}/generate`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  startSimulation(parkingId: string, interval: number = SPOT_CONSTANTS.SIMULATION_INTERVAL): Observable<ApiResponse<{ message: string }>> {
    return new Observable<ApiResponse<{ message: string }>>(observer => {
      this.http.post<ApiResponse<{ message: string }>>(
        `${this.API}/${parkingId}/simulate/start`,
        { interval },
        { headers: this.authHeaders() }
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.isSimulatingSubject.next(true);
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  stopSimulation(parkingId: string): Observable<ApiResponse<{ message: string }>> {
    return new Observable<ApiResponse<{ message: string }>>(observer => {
      this.http.post<ApiResponse<{ message: string }>>(
        `${this.API}/${parkingId}/simulate/stop`,
        {},
        { headers: this.authHeaders() }
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.isSimulatingSubject.next(false);
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  connectSocket(parkingId: string): void {
    this.currentParkingId = parkingId;

    if (this.socket?.connected) {
      this.socket.emit('join-parking', parkingId);
      return;
    }

    this.socket = io(this.WS, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: SPOT_CONSTANTS.MAX_RETRY_ATTEMPTS,
      reconnectionDelay: SPOT_CONSTANTS.RECONNECTION_DELAY
    });

    this.socket.on('connect', () => {
      this.connectedSubject.next(true);
      this.socket!.emit('join-parking', parkingId);
    });

    this.socket.on('spots-update', (payload: SimulationUpdate) => {
      if (payload.spots?.length) {
        this.spotsSubject.next(payload.spots);
      }
      if (payload.stats?.data) {
        this.statsSubject.next(payload.stats.data);
      }
      this.lastUpdateSubject.next(new Date(payload.timestamp));
      this.simulationUpdate$.next(payload);
    });

    this.socket.on('disconnect', () => {
      this.connectedSubject.next(false);
    });

    this.socket.on('connect_error', () => {
      this.connectedSubject.next(false);
    });

    this.loadInitialData(parkingId);
  }

  private loadInitialData(parkingId: string): void {
    this.getSpotsByParking(parkingId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.spotsSubject.next(response.data);
        }
      },
      error: (error) => console.error('Erreur chargement initial:', error)
    });

    this.getSpotStats(parkingId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.statsSubject.next(response.data);
        }
      },
      error: (error) => console.error('Erreur chargement stats:', error)
    });
  }

  disconnectSocket(parkingId: string): void {
    if (this.socket) {
      this.socket.emit('leave-parking', parkingId);
      this.socket.off('spots-update');
      this.socket.disconnect();
      this.socket = null;
      this.connectedSubject.next(false);
      this.currentParkingId = null;
    }
  }

  getSimulationUpdates(): Observable<SimulationUpdate> {
    return this.simulationUpdate$.asObservable();
  }

  refreshData(parkingId: string): void {
    if (this.currentParkingId === parkingId) {
      this.loadInitialData(parkingId);
    }
  }

  setSimulatingState(isSimulating: boolean): void {
    this.isSimulatingSubject.next(isSimulating);
  }

  reset(): void {
    this.spotsSubject.next([]);
    this.statsSubject.next(null);
    this.lastUpdateSubject.next(null);
    this.isSimulatingSubject.next(false);
  }

  isActiveParking(parkingId: string): boolean {
    return this.currentParkingId === parkingId && this.isConnected;
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.simulationUpdate$.complete();
    this.spotsSubject.complete();
    this.statsSubject.complete();
    this.isSimulatingSubject.complete();
    this.lastUpdateSubject.complete();
    this.connectedSubject.complete();
    this.loadingSubject.complete();
  }
}
