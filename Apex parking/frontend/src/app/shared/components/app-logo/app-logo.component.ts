import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  templateUrl: './app-logo.component.html',
  styleUrls: ['./app-logo.component.css']
})
export class AppLogoComponent {
  @Input() variant: 'full' | 'mark' = 'full';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() showTagline = false;
}
