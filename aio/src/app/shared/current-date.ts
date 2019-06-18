import { InjectionToken } from '@angular/core';

export let CurrentDateToken = new InjectionToken('CurrentDate');
export function currentDateProvider() { return new Date(); }
