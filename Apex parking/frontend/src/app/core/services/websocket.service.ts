import { Injectable, Inject, OnDestroy, Optional } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  WebSocketConfig,
  WEBSOCKET_CONFIG,
  DEFAULT_WEBSOCKET_CONFIG
} from '../config/websocket.config';

export interface WebSocketEvent {
  event: string;
  data: any;
}

export interface WebSocketConnectionStatus {
  isConnected: boolean;
  socketId: string | null;
  room: string | null;
  attempts: number;
  lastError: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  private reconnectAttempts = 0;

  private connectionStatusSubject = new BehaviorSubject<WebSocketConnectionStatus>({
    isConnected: false,
    socketId: null,
    room: null,
    attempts: 0,
    lastError: null
  });

  private eventSubject = new Subject<WebSocketEvent>();

  connectionStatus$ = this.connectionStatusSubject.asObservable();
  isConnected$ = this.connectionStatus$.pipe(map(status => status.isConnected));
  events$ = this.eventSubject.asObservable();

  constructor(
    @Optional() @Inject(WEBSOCKET_CONFIG)
    private config: WebSocketConfig = DEFAULT_WEBSOCKET_CONFIG
  ) {}

  connect(room?: string): void {
    if (this.socket?.connected) {
      if (room) this.joinRoom(room);
      return;
    }

    try {
      this.socket = io(this.config.url, {
        ...this.config.options,
        autoConnect: true
      });
      this.setupEventListeners();
      if (room) this.joinRoom(room);
    } catch (error) {
      console.error('Erreur de connexion WebSocket:', error);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on(this.config.events.connect, () => {
      this.reconnectAttempts = 0;
      this.updateConnectionStatus({
        isConnected: true,
        socketId: this.socket?.id || null,
        lastError: null
      });
      this.emitEvent('connect', { socketId: this.socket?.id });
    });

    this.socket.on(this.config.events.disconnect, (reason: string) => {
      this.updateConnectionStatus({
        isConnected: false,
        socketId: null,
        lastError: `Déconnecté: ${reason}`
      });
      this.emitEvent('disconnect', { reason });
    });

    this.socket.on(this.config.events.error, (error: Error) => {
      this.updateConnectionStatus({ lastError: error.message });
      this.emitEvent('error', { error: error.message });
    });

    this.socket.on(this.config.events.reconnectAttempt, (attempt: number) => {
      this.reconnectAttempts = attempt;
      this.updateConnectionStatus({ attempts: attempt });
    });

    this.socket.on(this.config.parkingEvents.joined, (data: any) => {
      this.currentRoom = data.room || data.parkingId || data;
      this.updateConnectionStatus({ room: this.currentRoom });
      this.emitEvent(this.config.parkingEvents.joined, data);
    });
  }

  joinRoom(roomId: string): void {
    if (!this.socket) {
      this.connect(roomId);
      return;
    }

    if (!this.socket.connected) {
      this.socket.connect();
      setTimeout(() => this.socket?.emit(this.config.parkingEvents.join, roomId), 1000);
      return;
    }

    if (this.currentRoom && this.currentRoom !== roomId) {
      this.leaveRoom(this.currentRoom);
    }

    this.socket.emit(this.config.parkingEvents.join, roomId);
    this.currentRoom = roomId;
    this.updateConnectionStatus({ room: roomId });
  }

  leaveRoom(roomId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit(this.config.parkingEvents.leave, roomId);
    if (this.currentRoom === roomId) {
      this.currentRoom = null;
      this.updateConnectionStatus({ room: null });
    }
  }

  on<T = any>(event: string): Observable<T> {
    return this.eventSubject.pipe(
      filter(e => e.event === event),
      map(e => e.data as T)
    );
  }

  onSpotsUpdate(): Observable<any> {
    return this.on(this.config.parkingEvents.update);
  }

  onStatsUpdate(): Observable<any> {
    return this.on(this.config.parkingEvents.stats);
  }

  emit(event: string, data: any): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit(event, data);
  }

  private emitEvent(event: string, data: any): void {
    this.eventSubject.next({ event, data });
  }

  private updateConnectionStatus(update: Partial<WebSocketConnectionStatus>): void {
    const current = this.connectionStatusSubject.getValue();
    this.connectionStatusSubject.next({ ...current, ...update });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  disconnect(): void {
    if (this.socket) {
      if (this.currentRoom) this.leaveRoom(this.currentRoom);
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
      this.updateConnectionStatus({
        isConnected: false,
        socketId: null,
        room: null
      });
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.eventSubject.complete();
    this.connectionStatusSubject.complete();
  }
}
