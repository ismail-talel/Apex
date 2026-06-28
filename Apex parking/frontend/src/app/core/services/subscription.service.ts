import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = `${environment.apiUrl}/subscriptions`;

  constructor(private http: HttpClient) {}

  public getPlansForParking(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/plans/parking/${parkingId}`);
  }

  public createPlan(plan: {
    name: string;
    description?: string;
    parkingId: string;
    price: number;
    durationDays: number;
    features?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/plans`, plan);
  }

  public updatePlan(planId: string, updates: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/plans/${planId}`, updates);
  }

  public getCompanySubscribers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/company/subscribers`);
  }

  public buySubscription(planId: string, paymentMethod: string = 'card'): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/buy`, { planId, paymentMethod });
  }

  public confirmSubscriptionPayment(subscriptionId: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${subscriptionId}/confirm`, {});
  }

  public verifySubscriptionPayment(subscriptionId: string, paymentRef?: string): Observable<any> {
    const params: Record<string, string> = {};
    if (paymentRef) params['payment_ref'] = paymentRef;
    return this.http.get<any>(`${this.apiUrl}/${subscriptionId}/verify-payment`, { params });
  }

  public getMySubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/client/my`);
  }

  public getAllSubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/all`);
  }
}
