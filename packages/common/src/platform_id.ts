/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

export let PLATFORM_BROWSER_ID = 'browser';
export let PLATFORM_SERVER_ID = 'server';
export let PLATFORM_WORKER_APP_ID = 'browserWorkerApp';
export let PLATFORM_WORKER_UI_ID = 'browserWorkerUi';

/**
 * Returns whether a platform id represents a browser platform.
 * @publicApi
 */
export function isPlatformBrowser(platformId: Object): boolean {
  return platformId === PLATFORM_BROWSER_ID;
}

/**
 * Returns whether a platform id represents a server platform.
 * @publicApi
 */
export function isPlatformServer(platformId: Object): boolean {
  return platformId === PLATFORM_SERVER_ID;
}

/**
 * Returns whether a platform id represents a web worker app platform.
 * @publicApi
 */
export function isPlatformWorkerApp(platformId: Object): boolean {
  return platformId === PLATFORM_WORKER_APP_ID;
}

/**
 * Returns whether a platform id represents a web worker UI platform.
 * @publicApi
 */
export function isPlatformWorkerUi(platformId: Object): boolean {
  return platformId === PLATFORM_WORKER_UI_ID;
}
