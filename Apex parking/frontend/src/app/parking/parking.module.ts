import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// ─── Components ────────────────────────────────────────────────────────────────
import { ParkingMapComponent } from './parking-map/parking-map.component';
import { ParkingDetailsComponent } from './parking-details/parking-details.component';
import { IaChatComponent } from './ia-chat/ia-chat.component';
import { ParkingSimulatorComponent } from './parking-simulator/parking-simulator.component';
import { ParkingSimulatorPageComponent } from './parking-simulator-page/parking-simulator-page.component';

// ─── Services ──────────────────────────────────────────────────────────────────
// Les services avec providedIn: 'root' n'ont pas besoin d'être dans providers
// import { ParkingService } from '../services/parking.service';
// import { IAService } from '../services/ia.service';
// import { LocationService } from '../services/location.service';

@NgModule({
  declarations: [
    ParkingMapComponent,
    ParkingDetailsComponent,
    IaChatComponent
    // ❌ NE PAS déclarer ParkingSimulatorComponent car il est standalone
    // ❌ NE PAS déclarer ParkingSimulatorPageComponent car il est standalone
  ],
  imports: [
    CommonModule,
    FormsModule,                    // ✅ Pour ngModel
    RouterModule,                   // ✅ Pour les liens de navigation
    ParkingSimulatorComponent,      // ✅ IMPORT des composants standalone
    ParkingSimulatorPageComponent   // ✅ IMPORT des composants standalone
  ],
  exports: [
    ParkingMapComponent,
    ParkingDetailsComponent,
    IaChatComponent
    // ⚠️ N'exporter que si utilisé dans d'autres modules
  ],
  providers: [
    // ❌ Les services avec providedIn: 'root' n'ont pas besoin d'être déclarés ici
    // ✅ Uniquement les services sans providedIn ou avec des configurations spécifiques
    // ParkingService,   // ← providedIn: 'root' (pas besoin)
    // IAService,        // ← providedIn: 'root' (pas besoin)
    // LocationService   // ← providedIn: 'root' (pas besoin)
  ]
})
export class ParkingModule { }