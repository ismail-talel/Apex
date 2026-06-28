import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParkingSimulatorComponent } from './parking-simulator.component';

describe('ParkingSimulatorComponent', () => {
  let component: ParkingSimulatorComponent;
  let fixture: ComponentFixture<ParkingSimulatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ParkingSimulatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParkingSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
