import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ComplaintService {
  private apiUrl = `${environment.apiUrl}/complaints`;

  constructor(private http: HttpClient) {}

  createComplaint(payload: {
    parkingId: string;
    reservationId?: string;
    subscriptionId?: string;
    subject: string;
    category: string;
    description: string;
    priority?: string;
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  getMyComplaints(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/my`);
  }

  getCompanyComplaints(status?: string): Observable<any> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<any>(`${this.apiUrl}/company`, { params });
  }

  getParkingComplaints(parkingId: string, status?: string): Observable<any> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<any>(`${this.apiUrl}/parking/${parkingId}`, { params });
  }

  getAllComplaints(filters?: { status?: string; priority?: string }): Observable<any> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    return this.http.get<any>(this.apiUrl, { params });
  }

  getComplaintById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  respondToComplaint(id: string, note: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/respond`, { note });
  }

  resolveComplaint(id: string, note: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/resolve`, { note });
  }

  escalateComplaint(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/escalate`, {});
  }

  rejectComplaint(id: string, reason: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/reject`, { reason });
  }

  closeComplaint(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/close`, {});
  }
}
