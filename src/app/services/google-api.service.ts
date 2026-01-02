import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../config';

declare var gapi: any;
declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleApiService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  private tokenClient: any;
  private gapiInitialized = false;
  private gisInitialized = false;

  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  async ensureInitialized(): Promise<void> {
    return this.initPromise;
  }

  private async init() {
    await Promise.all([this.loadGapi(), this.loadGis()]);
  }

  private loadGapi(): Promise<void> {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('client', async () => {
          await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
          });
          this.gapiInitialized = true;
          resolve();
        });
      };
      document.body.appendChild(script);
    });
  }

  private loadGis(): Promise<void> {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: environment.google.clientId,
          scope: environment.google.scope,
          callback: (tokenResponse: any) => this.handleAuthSuccess(tokenResponse),
        });
        this.gisInitialized = true;
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  private async handleAuthSuccess(tokenResponse: any) {
    if (gapi.client) {
      gapi.client.setToken(tokenResponse);
    }

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`
        }
      });
      const profile = await response.json();

      const user = {
        getBasicProfile: () => ({
          getGivenName: () => profile.given_name,
          getName: () => profile.name,
          getEmail: () => profile.email,
          getImageUrl: () => profile.picture
        })
      };

      this.userSubject.next(user);
    } catch (error) {
      console.error('Failed to fetch user profile', error);
      this.userSubject.next({
        getBasicProfile: () => ({
          getGivenName: () => 'User',
          getName: () => 'User',
          getEmail: () => '',
          getImageUrl: () => ''
        })
      });
    }
  }

  signIn() {
    if (this.gisInitialized && this.tokenClient) {
      this.tokenClient.requestAccessToken();
    } else {
      console.warn('Google Identity Services not ready yet. Retrying in 1s...');
      setTimeout(() => {
        if (this.gisInitialized && this.tokenClient) {
          this.tokenClient.requestAccessToken();
        } else {
          alert('Google Sign-In is still loading. Please check your internet connection and try again.');
        }
      }, 1000);
    }
  }

  signOut() {
    const token = gapi.client.getToken();
    if (token && token.access_token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        console.log('Token revoked');
      });
    }
    gapi.client.setToken(null);
    this.userSubject.next(null);
  }

  get isInitialized() {
    return this.gapiInitialized && this.gisInitialized;
  }
}
