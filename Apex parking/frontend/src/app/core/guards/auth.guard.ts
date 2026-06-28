import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth']);
      return false;
    }

    const expectedRoles = route.data['roles'] as Array<string>;
    const userRole = this.authService.getRole();

    if (expectedRoles && expectedRoles.length > 0 && (!userRole || !expectedRoles.includes(userRole))) {
      // User is logged in but doesn't have required permission, redirect to their role's home or auth
      if (userRole === 'super_admin') {
        this.router.navigate(['/admin']);
      } else if (userRole === 'company') {
        this.router.navigate(['/company']);
      } else if (userRole === 'employee') {
        this.router.navigate(['/employee']);
      } else if (userRole === 'client') {
        this.router.navigate(['/client']);
      } else {
        this.router.navigate(['/auth']);
      }
      return false;
    }

    return true;
  }
}
