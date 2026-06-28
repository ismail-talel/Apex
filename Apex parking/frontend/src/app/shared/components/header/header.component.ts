import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IAService } from '../../../core/services/ia.service';
import { LocationService } from '../../../core/services/location.service';
import { MockEmailService } from '../../../core/services/mock-email.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  // UI states
  showChat = false;
  showMailbox = false;
  isLoadingChat = false;
  isLoadingMail = false;

  // AI Chat state
  chatMessage = '';
  chatHistory: Array<{ sender: 'user' | 'bot'; text: string }> = [
    { sender: 'bot', text: 'Bonjour ! Je suis l\'assistant virtuel Apex. Posez-moi des questions sur les places libres, les forfaits d\'abonnements ou les parkings en Tunisie !' }
  ];
  suggestions: string[] = ['Parkings à Tunis', 'Tarifs abonnements', 'Aide', 'Dernière réservation'];

  // Mailbox state
  mockEmails: any[] = [];
  private mailInterval: any = null;
  private userCoordinates: { lat: number; lng: number } | null = null;

  constructor(
    public authService: AuthService,
    public router: Router,
    private iaService: IAService,
    private locationService: LocationService,
    private mockEmailService: MockEmailService
  ) {}

  ngOnInit(): void {
    this.locationService.getLocationObservable().subscribe((location) => {
      if (location) {
        this.userCoordinates = {
          lat: location.latitude,
          lng: location.longitude
        };
      }
    });

    if (this.authService.isLoggedIn()) {
      this.loadMockEmails();
      this.mailInterval = setInterval(() => {
        if (this.showMailbox) {
          this.loadMockEmails();
        }
      }, 5000);
    }
  }

  ngOnDestroy(): void {
    if (this.mailInterval) {
      clearInterval(this.mailInterval);
    }
  }

  logout(): void {
    this.authService.logout();
    this.showChat = false;
    this.showMailbox = false;
    this.router.navigate(['/auth']);
  }

  getRoleBadge(): string {
    const role = this.authService.getRole();
    const map: Record<string, string> = {
      super_admin: 'Administrateur',
      company: 'Entreprise',
      employee: 'Employé',
      client: 'Client'
    };
    return map[role || ''] || role || '';
  }

  get showFloatingChat(): boolean {
    if (!this.isClient()) return false;
    const url = this.router.url;
    return !url.startsWith('/chat') && !url.startsWith('/auth');
  }

  isClient(): boolean {
    return this.authService.getRole() === 'client';
  }

  goHome(): void {
    if (this.isClient()) {
      this.router.navigate(['/map']);
      return;
    }
    if (this.authService.isLoggedIn()) {
      this.goToDashboard();
      return;
    }
    this.router.navigate(['/auth']);
  }

  isClientReservationsActive(): boolean {
    return this.router.url.startsWith('/client') && this.router.url.includes('section=reservations');
  }

  goToReservations(): void {
    this.router.navigate(['/client'], { queryParams: { section: 'reservations' } });
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
  }

  isDashboardActive(): boolean {
    return ['/admin', '/company', '/employee', '/client'].some(path => this.router.url.startsWith(path));
  }

  goToDashboard(): void {
    const role = this.authService.getRole();
    const routes: Record<string, string> = {
      super_admin: '/admin',
      company: '/company',
      employee: '/employee',
      client: '/client'
    };
    this.router.navigate([routes[role || ''] || '/auth']);
  }

  // AI Chat functions
  toggleChat(): void {
    this.showChat = !this.showChat;
    if (this.showChat) {
      this.showMailbox = false;
    }
  }

  sendChatMessage(messageText?: string): void {
    const textToSend = messageText || this.chatMessage;
    if (!textToSend.trim()) return;

    // Add user message to history
    this.chatHistory.push({ sender: 'user', text: textToSend });
    if (!messageText) {
      this.chatMessage = '';
    }

    this.isLoadingChat = true;
    const currentUser = this.authService.currentUserValue;

    const payload = {
      message: textToSend,
      userId: currentUser?.id || currentUser?._id || 'anonymous',
      userName: currentUser?.name || 'Client',
      userEmail: currentUser?.email || 'client@example.com',
      coordinates: this.userCoordinates
    };

    this.iaService.chat(payload).subscribe({
      next: (res) => {
        this.isLoadingChat = false;
        this.chatHistory.push({ sender: 'bot', text: res.reply });
        if (res.suggestions && res.suggestions.length > 0) {
          this.suggestions = res.suggestions;
        }
      },
      error: (err) => {
        this.isLoadingChat = false;
        this.chatHistory.push({ sender: 'bot', text: 'Désolé, l\'assistant IA est momentanément indisponible.' });
      }
    });
  }

  clickSuggestion(s: string): void {
    this.sendChatMessage(s);
  }

  // Mock Mailbox functions
  toggleMailbox(): void {
    this.showMailbox = !this.showMailbox;
    if (this.showMailbox) {
      this.showChat = false;
      this.loadMockEmails();
    }
  }

  loadMockEmails(): void {
    this.isLoadingMail = true;
    this.mockEmailService.getMockEmails().subscribe({
      next: (res) => {
        this.isLoadingMail = false;
        this.mockEmails = res.emails || [];
      },
      error: () => {
        this.isLoadingMail = false;
      }
    });
  }

  clearMailbox(): void {
    if (!confirm('Voulez-vous vider la boîte de réception virtuelle ?')) return;

    this.isLoadingMail = true;
    this.mockEmailService.deleteMockEmails().subscribe({
      next: () => {
        this.isLoadingMail = false;
        this.mockEmails = [];
        this.loadMockEmails();
      },
      error: () => {
        this.isLoadingMail = false;
      }
    });
  }
}
