import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, ParkingLocation } from '../../parking/models/parking.model';

@Injectable({
  providedIn: 'root'
})
export class ParkingService {
  private readonly apiUrl = `${environment.apiUrl}/parking`;

  constructor(private http: HttpClient) {}

  getParkingLocations(): Observable<ApiResponse<ParkingLocation[]>> {
    return this.http.get<ApiResponse<ParkingLocation[]>>(`${this.apiUrl}/map/parkings`).pipe(
      map(response => this.normalizeResponse(response))
    );
  }

  getParkingById(id: string): Observable<ApiResponse<ParkingLocation>> {
    return this.http.get<ApiResponse<ParkingLocation>>(`${this.apiUrl}/map/parkings/${id}`).pipe(
      map(response => this.normalizeResponse(response))
    );
  }

  getParkingLocationById(parkingId: string): Observable<ApiResponse<ParkingLocation>> {
    return this.getParkingById(parkingId);
  }

  getNearbyParkings(lat: number, lng: number, radius: number = 5000): Observable<ApiResponse<ParkingLocation[]>> {
    return this.http.get<ApiResponse<ParkingLocation[]>>(
      `${this.apiUrl}/map/parkings/nearby`,
      { params: { lat: lat.toString(), lng: lng.toString(), radius: radius.toString() } }
    ).pipe(
      map(response => this.normalizeResponse(response))
    );
  }

  isParkingOpen(id: string): Observable<ApiResponse<{ isOpen: boolean; name: string }>> {
    return this.http.get<ApiResponse<{ isOpen: boolean; name: string }>>(
      `${this.apiUrl}/map/parkings/${id}/is-open`
    );
  }

  getMapStatistics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/statistics`);
  }

  getSpotsByParking(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots`);
  }

  getAvailableSpots(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/available`);
  }

  getSpotStats(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/stats`);
  }

  searchSpots(parkingId: string, params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/search`, { params });
  }

  getSpotById(spotId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/spots/${spotId}`);
  }

  updateSpotStatus(spotId: string, status: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/spots/${spotId}/status`, { status });
  }

  generateSpots(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/generate`, {});
  }

  startSimulation(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/simulate/start`, {});
  }

  stopSimulation(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/simulate/stop`, {});
  }

  private normalizeResponse<T extends ParkingLocation | ParkingLocation[]>(
    response: ApiResponse<T>
  ): ApiResponse<T> {
    const data = response.data ?? (response as any).parkings;
    if (!data) {
      return response;
    }

    if (Array.isArray(data)) {
      return {
        ...response,
        data: data.map(parking => this.normalizeParking(parking)) as T
      };
    }

    return {
      ...response,
      data: this.normalizeParking(data) as T
    };
  }

  private normalizeParking(parking: ParkingLocation & { _id?: string }): ParkingLocation {
    const id = parking.id ?? parking._id;
    return {
      ...parking,
      id: id ? String(id) : ''
    };
  }
}
