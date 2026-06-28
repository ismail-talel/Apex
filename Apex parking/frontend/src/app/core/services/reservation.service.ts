import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  public getAllReservations(params?: any): Observable<any> {
    return this.http.get<any>(this.apiUrl, { params });
  }

  public createReservation(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  public getMyReservations(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/my`);
  }

  public getReservationById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  public confirmReservation(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/confirm`, {});
  }

  public verifyReservationPayment(id: string, paymentRef?: string): Observable<any> {
    const params: Record<string, string> = {};
    if (paymentRef) params['payment_ref'] = paymentRef;
    return this.http.get<any>(`${this.apiUrl}/${id}/verify-payment`, { params });
  }

  public cancelReservation(id: string, reason?: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/cancel`, { reason });
  }

  public leaveReview(id: string, rating: number, comment?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/review`, { rating, comment });
  }

  public getParkingReservations(parkingId: string, params?: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/parking/${parkingId}`, { params });
  }

  public checkIn(id: string, qrCode?: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/checkin`, { qrCode });
  }

  public checkOut(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/checkout`, {});
  }

  public markNoShow(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/no-show`, {});
  }

  public verifyByQrCode(qrCode: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/qr/${qrCode}`);
  }

  public getParkingStats(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/parking/${parkingId}/stats`);
  }
}
