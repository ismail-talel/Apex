import { InjectionToken } from '@angular/core';
import { ManagerOptions, SocketOptions } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface WebSocketConfig {
  url: string;
  options: Partial<ManagerOptions & SocketOptions>;
  events: {
    connect: string;
    disconnect: string;
    error: string;
    reconnect: string;
    reconnectAttempt: string;
    reconnectError: string;
    reconnectFailed: string;
  };
  parkingEvents: {
    join: string;
    leave: string;
    joined: string;
    update: string;
    stats: string;
    error: string;
  };
}

export const WEBSOCKET_CONFIG = new InjectionToken<WebSocketConfig>('websocket.config');

export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  url: environment.wsUrl,
  options: environment.wsOptions,
  events: {
    connect: 'connect',
    disconnect: 'disconnect',
    error: 'connect_error',
    reconnect: 'reconnect',
    reconnectAttempt: 'reconnecting',
    reconnectError: 'reconnect_error',
    reconnectFailed: 'reconnect_failed'
  },
  parkingEvents: {
    join: 'join-parking',
    leave: 'leave-parking',
    joined: 'joined-parking',
    update: 'spots-update',
    stats: 'stats-update',
    error: 'error'
  }
};
