import { InjectionToken } from '@angular/core';

export let WindowToken = new InjectionToken('Window');
export function windowProvider() { return window; }
