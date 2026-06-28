import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ParkingSimulatorComponent } from '../parking-simulator/parking-simulator.component';
import { ParkingService } from '../../core/services/parking.service';
import { ParkingLocation } from '../models/parking.model';

@Component({
  selector: 'app-parking-simulator-page',
  standalone: true,
  imports: [CommonModule, ParkingSimulatorComponent],
  template: `
    <div class="simulator-page">
      <div class="simulator-header">
        <button (click)="goBack()" class="btn-back">
          ← Retour
        </button>
        <div class="header-title">
          <span class="icon">🎮</span>
          <div>
            <h1>{{ parking?.name || 'Simulation du parking' }}</h1>
            <p class="subtitle" *ngIf="parking">{{ parking.address }}, {{ parking.city }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button (click)="refreshSimulator()" class="btn-refresh">
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      <div class="quick-info" *ngIf="parking">
        <div class="info-chip">
          <span class="label">Places</span>
          <span class="value">{{ parking.availableSpots }} / {{ parking.totalSpots }}</span>
        </div>
        <div class="info-chip">
          <span class="label">Tarif</span>
          <span class="value">{{ parking.pricePerHour }} DT/h</span>
        </div>
        <div class="info-chip">
          <span class="label">Statut</span>
          <span class="value" [class.status-open]="isOpen" [class.status-closed]="!isOpen">
            {{ isOpen ? '🟢 Ouvert' : '🔴 Fermé' }}
          </span>
        </div>
        <div class="info-chip">
          <span class="label">Mode</span>
          <span class="value status-live">⚡ Simulation live</span>
        </div>
      </div>

      <div class="simulator-container" *ngIf="parkingId">
        <app-parking-simulator [parkingId]="parkingId"></app-parking-simulator>
      </div>

      <div class="loading-page" *ngIf="loading">
        <div class="page-spinner"></div>
        <span>Chargement du parking…</span>
      </div>
    </div>
  `,
  styles: [`
    .simulator-page {
      padding: 20px;
      max-width: 1500px;
      margin: 0 auto;
      background: #0a0b10;
      min-height: 100vh;
      color: #d1d5db;
    }

    .simulator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #13151e;
      border: 1px solid #1f2232;
      border-radius: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .btn-back {
      background: #1f2232;
      color: #9ca3af;
      border: 1px solid #2a2d3a;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      font-weight: 600;
    }

    .btn-back:hover {
      background: #2a2d3a;
      color: #f9fafb;
      transform: translateX(-2px);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-title .icon {
      font-size: 28px;
    }

    .header-title h1 {
      color: #f9fafb;
      font-weight: 600;
      font-size: 20px;
      margin: 0;
    }

    .subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #6b7280;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-refresh {
      background: #1e1b4b;
      color: #a5b4fc;
      border: 1px solid #4338ca;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-refresh:hover {
      background: #2d3a9e;
      color: white;
    }

    .quick-info {
      display: flex;
      gap: 16px;
      padding: 12px 20px;
      background: #13151e;
      border: 1px solid #1f2232;
      border-radius: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .info-chip {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-chip .label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-chip .value {
      font-size: 14px;
      font-weight: 600;
      color: #f9fafb;
    }

    .info-chip .value.status-live {
      color: #4ade80;
    }

    .info-chip .value.status-open {
      color: #4ade80;
    }

    .info-chip .value.status-closed {
      color: #f87171;
    }

    .simulator-container {
      background: #13151e;
      border: 1px solid #1f2232;
      border-radius: 12px;
      padding: 4px;
      overflow: hidden;
    }

    .loading-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 80px 20px;
      color: #6b7280;
    }

    .page-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #1f2232;
      border-top-color: #818cf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .simulator-header {
        flex-direction: column;
        align-items: stretch;
      }

      .header-title {
        justify-content: center;
        text-align: center;
      }

      .header-actions {
        justify-content: center;
      }

      .quick-info {
        justify-content: center;
      }

      .info-chip {
        align-items: center;
      }
    }
  `]
})
export class ParkingSimulatorPageComponent implements OnInit, OnDestroy {
  parkingId: string | null = null;
  parking: ParkingLocation | null = null;
  isOpen = false;
  loading = true;
  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private parkingService: ParkingService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.route.params.subscribe(params => {
        this.parkingId = params['id'] || null;
        if (this.parkingId) {
          this.loadParking(this.parkingId);
        }
      })
    );
  }

  private loadParking(id: string): void {
    this.loading = true;
    this.parkingService.getParkingById(id).subscribe({
      next: (res) => {
        this.parking = res.data || null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.parkingService.isParkingOpen(id).subscribe({
      next: (res) => {
        this.isOpen = res.data?.isOpen ?? false;
      }
    });
  }

  goBack(): void {
    if (this.parkingId) {
      this.router.navigate(['/parking', this.parkingId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  refreshSimulator(): void {
    if (this.parkingId) {
      this.loadParking(this.parkingId);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
