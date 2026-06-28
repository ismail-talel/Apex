import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  public getCompanies(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/companies`);
  }

  public approveCompany(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/companies/${id}/approve`, {});
  }

  public rejectCompany(id: string, reason?: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/companies/${id}/reject`, { reason });
  }

  public suspendCompany(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/companies/${id}/suspend`, {});
  }

  public getParkings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/parkings`);
  }

  public approveParking(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parkings/${id}/approve`, {});
  }

  public rejectParking(id: string, reason?: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parkings/${id}/reject`, { reason });
  }

  public blockParking(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parkings/${id}/block`, {});
  }

  public unblockParking(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parkings/${id}/unblock`, {});
  }
}
