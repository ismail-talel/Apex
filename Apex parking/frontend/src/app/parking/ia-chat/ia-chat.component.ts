import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';

import { IAService } from '../../core/services/ia.service';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';

import { ChatMessage } from '../models/ia.model';
import { UserLocation } from '../models/location.model';

@Component({
  selector: 'app-ia-chat',
  templateUrl: './ia-chat.component.html',
  styleUrls: ['./ia-chat.component.css']
})
export class IaChatComponent implements OnInit, OnDestroy {
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  userInput = '';
  isProcessing = false;
  isOpen = false;
  isMinimized = false;
  unreadCount = 0;
  iaOnline = true;

  userLocation: UserLocation | null = null;
  private subscriptions: Subscription[] = [];
  private sessionId = '';

  quickSuggestions = [
    'Où se garer près de Tunis ?',
    'Parking disponible à Carthage ?',
    'Prix du parking à Sidi Bou Said',
    'Réserver une place',
    'Parkings ouverts maintenant'
  ];

  constructor(
    private iaService: IAService,
    private locationService: LocationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.sessionId = this.resolveSessionId();

    const sub = this.locationService.getLocationObservable().subscribe(location => {
      if (location) {
        this.userLocation = location;
      }
    });
    this.subscriptions.push(sub);

    this.iaService.healthCheck().subscribe({
      next: (health) => {
        this.iaOnline = !!health?.mistralConfigured;
      },
      error: () => {
        this.iaOnline = false;
      }
    });

    setTimeout(() => {
      this.addBotMessage(
        '👋 Bonjour ! Je suis votre assistant parking en Tunisie.\n\n' +
        'Je peux vous aider à :\n' +
        '📍 Trouver un parking près de vous\n' +
        '🅿️ Vérifier la disponibilité\n' +
        '💰 Connaître les tarifs\n' +
        '⏰ Voir les horaires\n' +
        '📅 Réserver une place\n\n' +
        'Comment puis-je vous aider ?'
      );
    }, 500);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.locationService.stopWatching();
  }

  private resolveSessionId(): string {
    const user = this.authService.currentUserValue;
    const userId = user?.id || user?._id;
    if (userId) {
      return String(userId);
    }

    const stored = sessionStorage.getItem('ia_session_id');
    if (stored) {
      return stored;
    }

    const generated = `ia_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('ia_session_id', generated);
    return generated;
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.isMinimized = false;
      this.unreadCount = 0;
      setTimeout(() => {
        this.scrollToBottom();
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      }, 300);
    }
  }

  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    if (!this.isMinimized) {
      this.unreadCount = 0;
      setTimeout(() => this.scrollToBottom(), 300);
    }
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isProcessing) return;

    this.addUserMessage(text);
    this.userInput = '';
    this.isProcessing = true;

    const typingId = this.addTypingIndicator();
    const currentUser = this.authService.currentUserValue;

    const options: any = {
      userId: this.sessionId,
      userName: currentUser?.name || 'Utilisateur',
      userEmail: currentUser?.email
    };

    if (this.userLocation) {
      options.coordinates = {
        lat: this.userLocation.latitude,
        lng: this.userLocation.longitude
      };
    }

    this.iaService.chat(text, options).subscribe({
      next: (response) => {
        this.removeTypingIndicator(typingId);
        this.isProcessing = false;

        if (response && response.success) {
          const reply = response.reply || response.data?.message_formatee || 'Voici ma réponse.';
          this.addBotMessage(reply, response.suggestions, this.normalizeParkingData(response.data));
        } else {
          this.addBotMessage('❌ ' + (response?.reply || 'Désolé, une erreur est survenue.'));
        }
      },
      error: (error) => {
        this.removeTypingIndicator(typingId);
        this.isProcessing = false;
        console.error('Erreur IA:', error);
        const msg = error?.status === 429
          ? '⚠️ Trop de requêtes. Patientez une minute.'
          : '❌ Désolé, le service est temporairement indisponible. Veuillez réessayer plus tard.';
        this.addBotMessage(msg);
      }
    });
  }

  sendSuggestion(suggestion: string): void {
    this.userInput = suggestion;
    this.sendMessage();
  }

  private normalizeParkingData(data: any): any {
    if (!data) return null;
    if (data.bestParking) return data;
    if (data.data?.name && data.data?.availableSpots !== undefined) {
      return {
        bestParking: data.data,
        navigationUrl: data.navigation_url || data.navigationUrl
      };
    }
    if (data.name && data.availableSpots !== undefined) {
      return {
        bestParking: data,
        navigationUrl: data.navigation_url || data.navigationUrl
      };
    }
    return data;
  }

  private addUserMessage(text: string): void {
    this.messages.push({
      id: 'user_' + Date.now(),
      type: 'user',
      text: text,
      timestamp: new Date()
    });
    this.scrollToBottom();
  }

  private addBotMessage(text: string, suggestions?: string[], data?: any): void {
    this.messages.push({
      id: 'bot_' + Date.now(),
      type: 'bot',
      text: text,
      timestamp: new Date(),
      suggestions: suggestions || [],
      data: data
    });

    if (!this.isOpen) {
      this.unreadCount++;
    }
    this.scrollToBottom();
  }

  private addTypingIndicator(): string {
    const id = 'typing_' + Date.now();
    this.messages.push({
      id: id,
      type: 'bot',
      text: '...',
      timestamp: new Date(),
      isTyping: true
    });
    this.scrollToBottom();
    return id;
  }

  private removeTypingIndicator(id: string): void {
    const index = this.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      this.messages.splice(index, 1);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.chatContainer) {
          this.chatContainer.nativeElement.scrollTop =
            this.chatContainer.nativeElement.scrollHeight;
        }
      } catch {
        // ignore
      }
    }, 0);
  }

  formatText(text: string): string {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
  }

  hasParkingData(data: any): boolean {
    return !!(data?.bestParking || data?.parkings);
  }

  navigateToParking(data: any): void {
    const url = data?.navigationUrl || data?.navigation_url;
    if (url) {
      window.open(url, '_blank');
    }
  }

  formatPrice(price: number | string): string {
    if (!price) return '0 DT';
    const value = String(price);
    return value.includes('DT') ? value : `${value} DT`;
  }

  getStatusIcon(isOpen: boolean): string {
    return isOpen ? '🟢' : '🔴';
  }

  getStatusText(isOpen: boolean): string {
    return isOpen ? 'Ouvert' : 'Fermé';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
