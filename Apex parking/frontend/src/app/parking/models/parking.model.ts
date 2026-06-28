export interface ParkingLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  availableSpots: number;
  totalSpots: number;
  pricePerHour: number;
  status: string;
  rating: number;
  openingTime: string;
  closingTime: string;
  isOpen24h: boolean;
  contactPhone?: string;
  features?: string[];
  description?: string;
  images?: string[];
  distance?: number;
  distanceText?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
  error?: string;
}