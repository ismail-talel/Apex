// ─── Types de base ────────────────────────────────────────────────────────────
export type SpotType = 'STANDARD' | 'HANDICAP' | 'ELECTRIC' | 'COMPACT'
                     | 'MOTORCYCLE' | 'FAMILY' | 'VIP';

export type SpotStatus = 'ACTIVE' | 'MAINTENANCE' | 'BLOCKED';

export type SpotState = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'blocked';

export type FilterStatus = 'all' | 'available' | 'occupied' | 'reserved' | 'maintenance';

// ─── Réservation courante ──────────────────────────────────────────────────────
export interface CurrentReservation {
  bookingId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  vehiclePlate?: string;
  reservedUntil?: string;
  startTime?: string;
  endTime?: string;
}

// ─── Place de parking ──────────────────────────────────────────────────────────
export interface ParkingSpot {
  _id: string;
  parkingId: string;
  spotNumber: string;
  row: number;
  column: number;
  level: number;
  zone: string;
  type: SpotType;
  priceMultiplier: number;
  isAvailable: boolean;
  isReserved: boolean;
  status: SpotStatus;
  currentReservation?: CurrentReservation;
  totalReservations: number;
  lastReservedAt?: string;
  lastFreedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Statistiques ──────────────────────────────────────────────────────────────
export interface TypeStats {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
}

export interface HourlyOccupation {
  hour: number;
  occupation: number;
  label: string;
}

export interface SpotTrends {
  lastHour: string;
  lastDay: string;
  peakHour: string;
  mostActiveZone: string;
  leastActiveZone: string;
}

export interface SpotStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  blocked: number;
  occupancyRate: string;
  byType: Record<SpotType, TypeStats>;
  hourlyOccupation: HourlyOccupation[];
  trends: SpotTrends;
}

// ─── Mise à jour de la simulation ──────────────────────────────────────────────
export interface SimulationUpdate {
  type: string;
  parkingId: string;
  spots: ParkingSpot[];
  changedSpots: ParkingSpot[];
  timestamp: string;
  stats: {
    success: boolean;
    data: SpotStats;
  };
}

// ─── Filtres ──────────────────────────────────────────────────────────────────
export interface SpotFilters {
  zone?: string;
  type?: string;
  status?: FilterStatus;
}

// ─── Configuration ──────────────────────────────────────────────────────────────
export interface GenerateSpotsConfig {
  rows?: number;
  columns?: number;
  levels?: number;
  zones?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
  error?: string;
}

export interface ParkingOrganization {
  levels: number[];
  zones: string[];
  rows: number;
  columns: number;
  totalSpots: number;
}

// ─── Constantes ────────────────────────────────────────────────────────────────
export const SPOT_CONSTANTS = {
  TYPES: ['STANDARD', 'HANDICAP', 'ELECTRIC', 'COMPACT', 'MOTORCYCLE', 'FAMILY', 'VIP'] as SpotType[],
  STATUSES: ['ACTIVE', 'MAINTENANCE', 'BLOCKED'] as SpotStatus[],
  DEFAULT_CONFIG: {
    rows: 5,
    columns: 10,
    levels: 1,
    zones: ['A', 'B', 'C', 'D']
  },
  SIMULATION_INTERVAL: 3000,
  MAX_RETRY_ATTEMPTS: 5,
  RECONNECTION_DELAY: 2000
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export class ParkingSpotHelper {
  static getState(spot: ParkingSpot): SpotState {
    if (spot.status === 'MAINTENANCE') return 'maintenance';
    if (spot.status === 'BLOCKED') return 'blocked';
    if (spot.isReserved) return 'reserved';
    return spot.isAvailable ? 'available' : 'occupied';
  }

  static getStateLabel(spot: ParkingSpot): string {
    const states: Record<SpotState, string> = {
      available: 'Disponible',
      occupied: 'Occupé',
      reserved: 'Réservé',
      maintenance: 'Maintenance',
      blocked: 'Bloqué'
    };
    return states[this.getState(spot)] || 'Inconnu';
  }

  static getStateClass(spot: ParkingSpot): string {
    const state = this.getState(spot);
    return `s-${state.slice(0, 2)}`;
  }

  static getTypeIcon(type: SpotType): string {
    const icons: Record<SpotType, string> = {
      STANDARD: '',
      HANDICAP: '♿',
      ELECTRIC: '⚡',
      VIP: '★',
      FAMILY: '👨‍👩‍👧',
      MOTORCYCLE: '🏍️',
      COMPACT: '◾'
    };
    return icons[type] || '';
  }

  static isAvailable(spot: ParkingSpot): boolean {
    return spot.isAvailable && !spot.isReserved && spot.status === 'ACTIVE';
  }

  static isOccupied(spot: ParkingSpot): boolean {
    return !spot.isAvailable && !spot.isReserved && spot.status !== 'MAINTENANCE';
  }

  static filterSpots(spots: ParkingSpot[], filters: SpotFilters): ParkingSpot[] {
    let filtered = [...spots];

    if (filters.zone) {
      filtered = filtered.filter(s => s.zone === filters.zone);
    }

    if (filters.type) {
      filtered = filtered.filter(s => s.type === filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      switch (filters.status) {
        case 'available':
          filtered = filtered.filter(s => this.isAvailable(s));
          break;
        case 'occupied':
          filtered = filtered.filter(s => this.isOccupied(s));
          break;
        case 'reserved':
          filtered = filtered.filter(s => s.isReserved);
          break;
        case 'maintenance':
          filtered = filtered.filter(s => s.status === 'MAINTENANCE');
          break;
      }
    }

    return filtered;
  }

  static groupByZone(spots: ParkingSpot[]): Record<string, ParkingSpot[]> {
    return spots.reduce((groups, spot) => {
      const zone = spot.zone || 'NON_DEFINI';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(spot);
      return groups;
    }, {} as Record<string, ParkingSpot[]>);
  }
}