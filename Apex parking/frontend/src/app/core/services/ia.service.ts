import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IAService {
  private apiUrl = `${environment.apiUrl}/ia`;

  constructor(private http: HttpClient) {}

  public healthCheck(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/health`);
  }

  public getLocations(search?: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/locations`, {
      params: search ? { search } : {}
    });
  }

  public chat(
    messageOrPayload: string | {
      message: string;
      userId?: string;
      userName?: string;
      userEmail?: string;
      coordinates?: { lat: number; lng: number } | null;
    },
    options?: {
      userId?: string;
      userName?: string;
      userEmail?: string;
      coordinates?: { lat: number; lng: number };
    }
  ): Observable<any> {
    const payload = typeof messageOrPayload === 'string'
      ? { message: messageOrPayload, ...options }
      : messageOrPayload;
    return this.http.post<any>(`${this.apiUrl}/chat`, payload);
  }
}
