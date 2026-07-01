import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebauthnService } from '../../core/services/webauthn.service';
import { FaceAuthService } from '../../core/services/face-auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit, OnDestroy {
  activeTab: 'login' | 'register-client' | 'register-company' | 'forgot' | 'reset' = 'login';
  loginMode: 'password' | 'passkey' | 'face' = 'password';
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
  passkeySupported = false;
  cameraSupported = false;
  faceCameraActive = false;
  faceAuthMockMode = false;

  @ViewChild('faceVideo') faceVideoRef?: ElementRef<HTMLVideoElement>;

  constructor(
    private authService: AuthService,
    private webauthnService: WebauthnService,
    private faceAuthService: FaceAuthService,
    private router: Router
  ) {
    this.passkeySupported = this.webauthnService.isSupported();
    this.cameraSupported = this.faceAuthService.isCameraSupported();
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.redirectUser();
    }
    this.faceAuthService.getStatus().subscribe({
      next: (status) => {
        this.faceAuthMockMode = !!status.mockMode;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopFaceCamera();
  }

  switchLoginMode(mode: 'password' | 'passkey' | 'face'): void {
    if (this.loginMode === 'face' && mode !== 'face') {
      this.stopFaceCamera();
    }
    this.loginMode = mode;
    if (mode === 'face') {
      setTimeout(() => this.startFaceCamera(), 100);
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

  async onPasskeyLogin(): Promise<void> {
    if (!this.loginEmail) {
      this.showToast('Saisissez votre email pour utiliser la passkey', 'error');
      return;
    }
    if (!this.passkeySupported) {
      this.showToast('WebAuthn non supporté sur ce navigateur', 'error');
      return;
    }

    this.isLoading = true;
    try {
      const res = await this.webauthnService.loginWithPasskey(this.loginEmail.trim().toLowerCase());
      this.authService.loginWithSession(res);
      this.isLoading = false;
      this.showToast('Connexion par passkey réussie !');
      this.redirectUser();
    } catch (err: any) {
      this.isLoading = false;
      const msg = err?.error?.message || err?.message || 'Échec de la connexion par passkey';
      this.showToast(msg, 'error');
    }
  }

  async startFaceCamera(): Promise<void> {
    const video = this.faceVideoRef?.nativeElement;
    if (!video || this.faceCameraActive) return;
    try {
      await this.faceAuthService.startCamera(video);
      this.faceCameraActive = true;
    } catch {
      this.showToast('Impossible d\'accéder à la caméra', 'error');
    }
  }

  stopFaceCamera(): void {
    this.faceAuthService.stopCamera();
    this.faceCameraActive = false;
  }

  onFaceLogin(): void {
    const video = this.faceVideoRef?.nativeElement;
    if (!video || !this.faceCameraActive) {
      this.showToast('Activez la caméra avant de vous connecter', 'error');
      return;
    }

    this.isLoading = true;
    try {
      const image = this.faceAuthService.captureFrame(video);
      this.faceAuthService.verifyFace(image).subscribe({
        next: (res) => {
          this.authService.loginWithSession(res);
          this.isLoading = false;
          this.showToast('Connexion par reconnaissance faciale réussie !');
          this.stopFaceCamera();
          this.redirectUser();
        },
        error: (err) => {
          this.isLoading = false;
          this.showToast(err.error?.message || 'Visage non reconnu', 'error');
        }
      });
    } catch (err: any) {
      this.isLoading = false;
      this.showToast(err.message || 'Erreur de capture', 'error');
    }
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
