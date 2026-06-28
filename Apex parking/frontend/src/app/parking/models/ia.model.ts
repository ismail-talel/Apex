export interface IAMessage {
  message: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface IAResponse {
  success: boolean;
  reply: string;
  suggestions?: string[];
  data?: any;
  actionsExecuted?: string[];
  mode?: string;
  error?: string;
}

export interface IAHealth {
  status: string;
  service: string;
  version: string;
  mistralConfigured: boolean;
  locationsCount: number;
  endpoints: any;
  timestamp: string;
}

export interface IALocation {
  name: string;
  lat: number;
  lng: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  data?: any;
  isTyping?: boolean;
  suggestions?: string[];
}