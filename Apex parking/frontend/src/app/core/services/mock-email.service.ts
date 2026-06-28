import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MockEmailService {
  private apiUrl = 'http://localhost:5000/api/mock-emails';

  constructor(private http: HttpClient) {}

  public getMockEmails(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  public deleteMockEmails(): Observable<any> {
    return this.http.delete<any>(this.apiUrl);
  }
}
