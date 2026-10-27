import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    // Date fields use Material's datepicker popup; this supplies the Date adapter it needs
    provideNativeDateAdapter(),
    // Material overlays, sidenav and menus depend on Angular animations
    provideAnimationsAsync()
  ]
};
