/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


let xhr2: any = require('xhr2');

import {Injectable, Injector, Provider} from '@angular/core';

import {HttpEvent, HttpRequest, HttpHandler, HttpBackend, XhrFactory, ɵHttpInterceptingHandler as HttpInterceptingHandler} from '@angular/common/http';

import {Observable, Observer, Subscription} from 'rxjs';

@Injectable()
export class ServerXhr implements XhrFactory {
  build(): XMLHttpRequest { return new xhr2.XMLHttpRequest(); }
}

export abstract class ZoneMacroTaskWrapper<S, R> {
  wrap(request: S): Observable<R> {
    return new Observable((observer: Observer<R>) => {
      let task: Task = null !;
      let scheduled: boolean = false;
      let sub: Subscription|null = null;
      let savedResult: any = null;
      let savedError: any = null;

      let scheduleTask = (_task: Task) => {
        task = _task;
        scheduled = true;

        let delegate = this.delegate(request);
        sub = delegate.subscribe(
            res => savedResult = res,
            err => {
              if (!scheduled) {
                throw new Error(
                    'An http observable was completed twice. This shouldn\'t happen, please file a bug.');
              }
              savedError = err;
              scheduled = false;
              task.invoke();
            },
            () => {
              if (!scheduled) {
                throw new Error(
                    'An http observable was completed twice. This shouldn\'t happen, please file a bug.');
              }
              scheduled = false;
              task.invoke();
            });
      };

      let cancelTask = (_task: Task) => {
        if (!scheduled) {
          return;
        }
        scheduled = false;
        if (sub) {
          sub.unsubscribe();
          sub = null;
        }
      };

      let onComplete = () => {
        if (savedError !== null) {
          observer.error(savedError);
        } else {
          observer.next(savedResult);
          observer.complete();
        }
      };

      // MockBackend for Http is synchronous, which means that if scheduleTask is by
      // scheduleMacroTask, the request will hit MockBackend and the response will be
      // sent, causing task.invoke() to be called.
      let _task = Zone.current.scheduleMacroTask(
          'ZoneMacroTaskWrapper.subscribe', onComplete, {}, () => null, cancelTask);
      scheduleTask(_task);

      return () => {
        if (scheduled && task) {
          task.zone.cancelTask(task);
          scheduled = false;
        }
        if (sub) {
          sub.unsubscribe();
          sub = null;
        }
      };
    });
  }

  protected abstract delegate(request: S): Observable<R>;
}

export class ZoneClientBackend extends
    ZoneMacroTaskWrapper<HttpRequest<any>, HttpEvent<any>> implements HttpBackend {
  letructor(private backend: HttpBackend) { super(); }

  handle(request: HttpRequest<any>): Observable<HttpEvent<any>> { return this.wrap(request); }

  protected delegate(request: HttpRequest<any>): Observable<HttpEvent<any>> {
    return this.backend.handle(request);
  }
}

export function zoneWrappedInterceptingHandler(backend: HttpBackend, injector: Injector) {
  let realBackend: HttpBackend = new HttpInterceptingHandler(backend, injector);
  return new ZoneClientBackend(realBackend);
}

export let SERVER_HTTP_PROVIDERS: Provider[] = [
  {provide: XhrFactory, useClass: ServerXhr}, {
    provide: HttpHandler,
    useFactory: zoneWrappedInterceptingHandler,
    deps: [HttpBackend, Injector]
  }
];
