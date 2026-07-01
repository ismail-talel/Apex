import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebauthnService {
  private apiUrl = `${environment.apiUrl}/auth/webauthn`;

  constructor(private http: HttpClient) {}

  isSupported(): boolean {
    return typeof window !== 'undefined'
      && !!window.PublicKeyCredential
      && typeof window.PublicKeyCredential === 'function';
  }

  getLoginOptions(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login/options`, { email });
  }

  async loginWithPasskey(email: string): Promise<any> {
    const options = await firstValueFrom(this.getLoginOptions(email));
    const authResponse = await startAuthentication({ optionsJSON: options });
    return firstValueFrom(this.http.post(`${this.apiUrl}/login/verify`, {
      email,
      ...authResponse
    }));
  }

  getRegistrationOptions(): Observable<any> {
    return this.http.post(`${this.apiUrl}/register/options`, {});
  }

  async registerPasskey(friendlyName?: string): Promise<any> {
    const options = await firstValueFrom(this.getRegistrationOptions());
    const regResponse = await startRegistration({ optionsJSON: options });
    return firstValueFrom(this.http.post(`${this.apiUrl}/register/verify`, {
      ...regResponse,
      friendlyName: friendlyName || 'Passkey Apex'
    }));
  }

  listCredentials(): Observable<any> {
    return this.http.get(`${this.apiUrl}/credentials`);
  }

  deleteCredential(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/credentials/${id}`);
  }
}
