import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthComponent } from './features/auth/auth.component';
import { AdminComponent } from './features/admin/admin.component';
import { CompanyComponent } from './features/company/company.component';
import { ClientComponent } from './features/client/client.component';
import { EmployeeComponent } from './features/employee/employee.component';
import { AuthGuard } from './core/guards/auth.guard';
import { ParkingMapComponent } from './parking/parking-map/parking-map.component';
import { ParkingDetailsComponent } from './parking/parking-details/parking-details.component';
import { IaChatComponent } from './parking/ia-chat/ia-chat.component';
import { ParkingSimulatorPageComponent } from './parking/parking-simulator-page/parking-simulator-page.component';

const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [AuthGuard],
    data: { roles: ['super_admin'] }
  },
  {
    path: 'company',
    component: CompanyComponent,
    canActivate: [AuthGuard],
    data: { roles: ['company'] }
  },
  {
    path: 'employee',
    component: EmployeeComponent,
    canActivate: [AuthGuard],
    data: { roles: ['employee'] }
  },
  {
    path: 'client',
    component: ClientComponent,
    canActivate: [AuthGuard],
    data: { roles: ['client'] }
  },
  {
    path: 'map',
    component: ParkingMapComponent,
    canActivate: [AuthGuard],
    data: { roles: ['client'] }
  },
  {
    path: 'parking/:id',
    component: ParkingDetailsComponent,
    canActivate: [AuthGuard],
    data: { roles: ['client'] }
  },
  {
    path: 'parking/:id/simulator',
    component: ParkingSimulatorPageComponent,
    canActivate: [AuthGuard],
    data: { roles: ['client'] }
  },
  {
    path: 'chat',
    component: IaChatComponent,
    canActivate: [AuthGuard],
    data: { roles: ['client'] }
  },
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
