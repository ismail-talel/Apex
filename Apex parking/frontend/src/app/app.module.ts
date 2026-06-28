import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthComponent } from './features/auth/auth.component';
import { AdminComponent } from './features/admin/admin.component';
import { CompanyComponent } from './features/company/company.component';
import { ClientComponent } from './features/client/client.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { AppLogoComponent } from './shared/components/app-logo/app-logo.component';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { EmployeeComponent } from './features/employee/employee.component';
import { ParkingModule } from './parking/parking.module';

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    AdminComponent,
    CompanyComponent,
    ClientComponent,
    HeaderComponent,
    AppLogoComponent,
    EmployeeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    ParkingModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
