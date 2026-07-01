import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FaceAuthService {
  private apiUrl = `${environment.apiUrl}/face-auth`;
  private stream: MediaStream | null = null;

  constructor(private http: HttpClient) {}

  isCameraSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    videoElement.srcObject = this.stream;
    await videoElement.play();
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  captureFrame(videoElement: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible de capturer l\'image.');
    }
    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  getStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`);
  }

  verifyFace(image: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify`, { image });
  }

  enrollFace(image: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/enroll`, { image });
  }

  removeEnrollment(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/enroll`);
  }
}
