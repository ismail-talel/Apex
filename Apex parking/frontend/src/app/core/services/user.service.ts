import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  public getMe(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me`);
  }

  public updateMe(updates: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/me`, updates);
  }

  public deleteMe(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/me`);
  }

  public submitParkingRequest(parking: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/parking-request`, parking);
  }

  public getCompanyParkings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/company/parkings`);
  }

  public createEmployee(employee: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/employees`, employee);
  }

  public getEmployees(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/employees`);
  }

  // Admin capabilities mapped in users controller
  public getUsers(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  public getUserById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  public updateUser(id: string, updates: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, updates);
  }

  public deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
