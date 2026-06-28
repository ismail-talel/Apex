import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {
  activeTab: 'login' | 'register-client' | 'register-company' | 'forgot' | 'reset' = 'login';
  readonly demoClientEmail = 'client@smartparking.com';
  readonly demoClientPassword = 'Client123!';
  readonly demoAdminEmail = 'admin@smartparking.com';
  readonly demoAdminPassword = 'Admin123!';
  readonly demoCompanyEmail = 'company@smartparking.com';
  readonly demoCompanyPassword = 'Company123!';
  
  // Login inputs
  loginEmail = '';
  loginPassword = '';

  // Client inputs
  clientName = '';
  clientEmail = '';
  clientPassword = '';
  clientPhone = '';
  clientPlate = '';
  clientSerial = '';
  clientVehicleType = 'car';

  // Company inputs
  companyName = '';
  companyEmail = '';
  companyPassword = '';
  companyPhone = '';
  companySiret = '';
  companyAddress = '';

  // Password recovery
  recoverEmail = '';
  resetToken = '';
  resetPasswordVal = '';

  // UI state
  isLoading = false;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.redirectUser();
    }
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 4000);
  }

  switchTab(tab: 'login' | 'register-client' | 'register-company' | 'forgot' | 'reset'): void {
    this.activeTab = tab;
  }

  fillDemoClient(): void {
    this.loginEmail = this.demoClientEmail;
    this.loginPassword = this.demoClientPassword;
  }

  fillDemoAdmin(): void {
    this.loginEmail = this.demoAdminEmail;
    this.loginPassword = this.demoAdminPassword;
  }

  fillDemoCompany(): void {
    this.loginEmail = this.demoCompanyEmail;
    this.loginPassword = this.demoCompanyPassword;
  }

  onLogin(event: Event): void {
    event.preventDefault();
    if (!this.loginEmail || !this.loginPassword) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    this.isLoading = true;
    const email = this.loginEmail.trim().toLowerCase();
    const password = this.loginPassword;

    this.authService.login({ email, password }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Connexion réussie !');
        this.redirectUser();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0) {
          this.showToast('Impossible de joindre le serveur. Démarrez le backend : cd backend && npm start', 'error');
          return;
        }
        if (err.status === 404) {
          this.showToast('API introuvable. Vérifiez que le backend tourne sur le port 5000.', 'error');
          return;
        }
        if (err.status === 401) {
          this.showToast('Email ou mot de passe invalide. Utilisez le bouton « Remplir automatiquement » pour le compte test.', 'error');
          return;
        }
        const msg = err.error?.message
          || err.error?.errors?.[0]?.msg
          || 'Erreur de connexion.';
        this.showToast(msg, 'error');
      }
    });
  }

  onRegisterClient(event: Event): void {
    event.preventDefault();
    if (!this.clientName || !this.clientEmail || !this.clientPassword || !this.clientPhone || !this.clientPlate || !this.clientSerial) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    const payload = {
      name: this.clientName,
      email: this.clientEmail,
      password: this.clientPassword,
      phone: this.clientPhone,
      role: 'client',
      vehiclePlate: this.clientPlate,
      vehicleSerialNumber: this.clientSerial,
      vehicleType: this.clientVehicleType
    };

    this.isLoading = true;
    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Compte Client créé avec succès !');
        this.redirectUser();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de l\'inscription', 'error');
      }
    });
  }

  onRegisterCompany(event: Event): void {
    event.preventDefault();
    if (!this.companyName || !this.companyEmail || !this.companyPassword || !this.companyPhone || !this.companySiret || !this.companyAddress) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    const payload = {
      name: this.companyName,
      email: this.companyEmail,
      password: this.companyPassword,
      phone: this.companyPhone,
      role: 'company',
      siret: this.companySiret,
      address: this.companyAddress
    };

    this.isLoading = true;
    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Inscription réussie ! Votre compte entreprise est en attente d\'approbation.');
        this.switchTab('login');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de l\'inscription', 'error');
      }
    });
  }

  onForgotPassword(event: Event): void {
    event.preventDefault();
    if (!this.recoverEmail) {
      this.showToast('Veuillez saisir votre adresse email', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.recoverEmail).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Lien de réinitialisation généré ! Consultez la boîte mail virtuelle.');
        // Fill token automatically from backend mock response for testing convenience!
        if (res.resetToken) {
          this.resetToken = res.resetToken;
        }
        this.switchTab('reset');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Adresse email introuvable', 'error');
      }
    });
  }

  onResetPassword(event: Event): void {
    event.preventDefault();
    if (!this.resetToken || !this.resetPasswordVal) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword({ token: this.resetToken, password: this.resetPasswordVal }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Mot de passe réinitialisé avec succès ! Connectez-vous.');
        this.switchTab('login');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Token invalide ou expiré', 'error');
      }
    });
  }

  redirectUser(): void {
    const role = this.authService.getRole();
    if (role === 'super_admin') {
      this.router.navigate(['/admin']);
    } else if (role === 'company') {
      this.router.navigate(['/company']);
    } else if (role === 'employee') {
      this.router.navigate(['/employee']);
    } else if (role === 'client') {
      this.router.navigate(['/map']);
    } else {
      this.router.navigate(['/auth']);
    }
  }
}
