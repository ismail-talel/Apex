import {
  Component, OnInit, OnDestroy, Input,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  ParkingSpotService,
  ParkingSpot,
  SpotStats,
  ParkingSpotHelper,
  FilterStatus,
  SpotFilters,
  SPOT_CONSTANTS
} from '../../core/services/parking-spot.service';

type ViewMode = 'grid' | 'zone' | 'plan';

interface ActivityEvent {
  id: string;
  time: Date;
  type: 'occupied' | 'freed' | 'reserved' | 'maintenance';
  spotNumber: string;
  zone: string;
  message: string;
}

interface PlanRow {
  row: number;
  spots: ParkingSpot[];
}

interface PlanZone {
  zone: string;
  rows: PlanRow[];
  available: number;
  total: number;
}

interface PlanLevel {
  level: number;
  zones: PlanZone[];
}

@Component({
  selector: 'app-parking-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parking-simulator.component.html',
  styleUrls: ['./parking-simulator.component.css']
})
export class ParkingSimulatorComponent implements OnInit, OnDestroy {
  @Input({ required: true }) parkingId!: string;

  // Données
  allSpots: ParkingSpot[] = [];
  filteredSpots: ParkingSpot[] = [];
  stats: SpotStats | null = null;
  detail: ParkingSpot | null = null;
  flashIds = new Set<string>();
  zoneGroups: Record<string, ParkingSpot[]> = {};
  zoneKeys: string[] = [];
  planLevels: PlanLevel[] = [];
  activityLog: ActivityEvent[] = [];
  private spotStateMap = new Map<string, string>();

  // États
  isSimulating = false;
  simLoading = false;
  loading = true;
  wsConnected = false;
  lastUpdate: Date | null = null;
  showActivity = true;
  simInterval: number = SPOT_CONSTANTS.SIMULATION_INTERVAL;
  searchQuery = '';
  updateCount = 0;

  // Filtres
  filterStatus: FilterStatus = 'all';
  filterType = '';
  selectedZone = '';
  selectedLevel = '';
  viewMode: ViewMode = 'plan';
  zones: string[] = [];
  levels: number[] = [];
  spotTypes = SPOT_CONSTANTS.TYPES;
  simSpeeds = [
    { label: 'Lent', value: 5000 },
    { label: 'Normal', value: 3000 },
    { label: 'Rapide', value: 1000 }
  ];

  private subs = new Subscription();

  constructor(
    private svc: ParkingSpotService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.svc.connectSocket(this.parkingId);

    this.subs.add(this.svc.spots$.subscribe(spots => {
      this.allSpots = spots;
      spots.forEach(s => {
        if (!this.spotStateMap.has(s._id)) {
          this.spotStateMap.set(s._id, this.state(s));
        }
      });
      this.buildMeta();
      this.applyFilters();
      this.loading = false;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.svc.stats$.subscribe(s => {
      if (s) { this.stats = s; this.cdr.markForCheck(); }
    }));

    this.subs.add(this.svc.lastUpdate$.subscribe(d => {
      this.lastUpdate = d;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.svc.connected$.subscribe(c => {
      this.wsConnected = c;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.svc.isSimulating$.subscribe(sim => {
      this.isSimulating = sim;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.svc.getSimulationUpdates().subscribe(upd => {
      this.updateCount++;
      upd.changedSpots.forEach(s => {
        this.flashIds.add(s._id);
        this.logActivity(s);
        setTimeout(() => {
          this.flashIds.delete(s._id);
          this.cdr.markForCheck();
        }, 650);
      });
      this.cdr.markForCheck();
    }));
  }

  private logActivity(spot: ParkingSpot): void {
    const prev = this.spotStateMap.get(spot._id);
    const current = this.state(spot);
    this.spotStateMap.set(spot._id, current);

    if (prev === current) return;

    let type: ActivityEvent['type'];
    let message: string;

    switch (current) {
      case 'occupied':
        type = 'occupied';
        message = `Place ${spot.spotNumber} occupée`;
        break;
      case 'available':
        type = 'freed';
        message = `Place ${spot.spotNumber} libérée`;
        break;
      case 'reserved':
        type = 'reserved';
        message = `Place ${spot.spotNumber} réservée`;
        break;
      case 'maintenance':
        type = 'maintenance';
        message = `Place ${spot.spotNumber} en maintenance`;
        break;
      default:
        return;
    }

    this.activityLog.unshift({
      id: `${spot._id}-${Date.now()}`,
      time: new Date(),
      type,
      spotNumber: spot.spotNumber,
      zone: spot.zone,
      message
    });

    if (this.activityLog.length > 50) {
      this.activityLog = this.activityLog.slice(0, 50);
    }
  }

  private buildMeta(): void {
    this.zones = [...new Set(this.allSpots.map(s => s.zone))].sort();
    this.levels = [...new Set(this.allSpots.map(s => s.level))].sort((a, b) => a - b);
  }

  applyFilters(): void {
    const filters: SpotFilters = {
      zone: this.selectedZone || undefined,
      type: this.filterType || undefined,
      status: this.filterStatus
    };

    let spots = ParkingSpotHelper.filterSpots(this.allSpots, filters);

    if (this.selectedLevel !== '' && this.selectedLevel !== null) {
      const level = Number(this.selectedLevel);
      spots = spots.filter(spot => spot.level === level);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      spots = spots.filter(s =>
        s.spotNumber.toLowerCase().includes(q) ||
        s.zone.toLowerCase().includes(q)
      );
    }

    this.filteredSpots = spots;
    this.zoneGroups = ParkingSpotHelper.groupByZone(this.filteredSpots);
    this.zoneKeys = Object.keys(this.zoneGroups).sort();
    this.buildPlanLayout();
  }

  private buildPlanLayout(): void {
    const levelMap = new Map<number, Map<string, Map<number, ParkingSpot[]>>>();

    this.filteredSpots.forEach(spot => {
      if (!levelMap.has(spot.level)) levelMap.set(spot.level, new Map());
      const zoneMap = levelMap.get(spot.level)!;
      if (!zoneMap.has(spot.zone)) zoneMap.set(spot.zone, new Map());
      const rowMap = zoneMap.get(spot.zone)!;
      if (!rowMap.has(spot.row)) rowMap.set(spot.row, []);
      rowMap.get(spot.row)!.push(spot);
    });

    this.planLevels = [...levelMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, zoneMap]) => ({
        level,
        zones: [...zoneMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([zone, rowMap]) => {
            const allZoneSpots = [...rowMap.values()].flat();
            return {
              zone,
              available: allZoneSpots.filter(s => ParkingSpotHelper.isAvailable(s)).length,
              total: allZoneSpots.length,
              rows: [...rowMap.entries()]
                .sort(([a], [b]) => a - b)
                .map(([row, spots]) => ({
                  row,
                  spots: spots.sort((a, b) => a.column - b.column)
                }))
            };
          })
      }));
  }

  setSimSpeed(interval: number): void {
    this.simInterval = interval;
    if (this.isSimulating) {
      this.svc.stopSimulation(this.parkingId).subscribe({
        next: () => {
          this.svc.startSimulation(this.parkingId, interval).subscribe(() => {
            this.cdr.markForCheck();
          });
        }
      });
    }
    this.cdr.markForCheck();
  }

  clearActivity(): void {
    this.activityLog = [];
    this.cdr.markForCheck();
  }

  getOccupancyColor(rate: string): string {
    const n = parseFloat(rate);
    if (n < 50) return '#22c55e';
    if (n < 80) return '#f59e0b';
    return '#ef4444';
  }

  getHourlyMax(): number {
    if (!this.stats?.hourlyOccupation?.length) return 100;
    return Math.max(...this.stats.hourlyOccupation.map(h => h.occupation), 1);
  }

  activityIcon(type: ActivityEvent['type']): string {
    const icons = { occupied: '🚗', freed: '✅', reserved: '📅', maintenance: '🔧' };
    return icons[type];
  }

  isAisleAfter(rowIndex: number): boolean {
    return (rowIndex + 1) % 2 === 0;
  }

  toggleSimulation(): void {
    this.simLoading = true;
    if (this.isSimulating) {
      this.svc.stopSimulation(this.parkingId).subscribe({
        next: () => { this.simLoading = false; this.cdr.markForCheck(); },
        error: () => { this.simLoading = false; this.cdr.markForCheck(); }
      });
    } else {
      this.svc.startSimulation(this.parkingId, this.simInterval).subscribe({
        next: () => { this.simLoading = false; this.cdr.markForCheck(); },
        error: () => { this.simLoading = false; this.cdr.markForCheck(); }
      });
    }
  }

  genSpots(): void {
    this.svc.generateSpots(this.parkingId).subscribe(() => {
      this.svc.refreshData(this.parkingId);
    });
  }

  open(s: ParkingSpot): void {
    this.detail = s;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.detail = null;
    this.cdr.markForCheck();
  }

  state(s: ParkingSpot): string {
    return ParkingSpotHelper.getState(s);
  }

  stateLabel(s: ParkingSpot): string {
    return ParkingSpotHelper.getStateLabel(s);
  }

  spotCls(s: ParkingSpot): string {
    const state = ParkingSpotHelper.getStateClass(s);
    const type = `t-${s.type}`;
    const occupied = this.state(s) === 'occupied' ? 'has-car' : '';
    return `${state} ${type} ${occupied}`.trim();
  }

  typeIcon(type: string): string {
    return ParkingSpotHelper.getTypeIcon(type as any);
  }

  zoneAvail(z: string): number {
    return (this.zoneGroups[z] ?? []).filter(s => ParkingSpotHelper.isAvailable(s)).length;
  }

  trackId(_: number, s: ParkingSpot): string {
    return s._id;
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDetail();
    }
  }

  onDetailClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.svc.disconnectSocket(this.parkingId);
  }
}