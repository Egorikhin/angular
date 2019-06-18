/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import 'reflect-metadata';

import * as ts from 'typescript';

import {createLanguageService} from '../src/language_service';
import {Hover} from '../src/types';
import {TypeScriptServiceHost} from '../src/typescript_host';

import {toh} from './test_data';
import {MockTypescriptHost} from './test_utils';

describe('hover', () => {
  let documentRegistry = ts.createDocumentRegistry();
  let mockHost = new MockTypescriptHost(['/app/main.ts', '/app/parsing-cases.ts'], toh);
  let service = ts.createLanguageService(mockHost, documentRegistry);
  let ngHost = new TypeScriptServiceHost(mockHost, service);
  let ngService = createLanguageService(ngHost);
  ngHost.setSite(ngService);


  it('should be able to find field in an interpolation', () => {
    hover(
        ` @Component({template: '{{«name»}}'}) export class MyComponent { name: string; }`,
        'property name of MyComponent');
  });

  it('should be able to find a field in a attribute reference', () => {
    hover(
        ` @Component({template: '<input [(ngModel)]="«name»">'}) export class MyComponent { name: string; }`,
        'property name of MyComponent');
  });

  it('should be able to find a method from a call', () => {
    hover(
        ` @Component({template: '<div (click)="«ᐱmyClickᐱ()»;"></div>'}) export class MyComponent { myClick() { }}`,
        'method myClick of MyComponent');
  });

  it('should be able to find a field reference in an *ngIf', () => {
    hover(
        ` @Component({template: '<div *ngIf="«include»"></div>'}) export class MyComponent { include = true;}`,
        'property include of MyComponent');
  });

  it('should be able to find a reference to a component', () => {
    hover(
        ` @Component({template: '«<ᐱtestᐱ-comp></test-comp>»'}) export class MyComponent { }`,
        'component TestComponent');
  });

  it('should be able to find an event provider', () => {
    hover(
        ` @Component({template: '<test-comp «(ᐱtestᐱ)="myHandler()"»></div>'}) export class MyComponent { myHandler() {} }`,
        'event testEvent of TestComponent');
  });

  it('should be able to find an input provider', () => {
    hover(
        ` @Component({template: '<test-comp «[ᐱtcNameᐱ]="name"»></div>'}) export class MyComponent { name = 'my name'; }`,
        'property name of TestComponent');
  });

  it('should be able to ignore a reference declaration', () => {
    addCode(
        ` @Component({template: '<div #«chart»></div>'}) export class MyComponent {  }`,
        fileName => {
          let markers = mockHost.getReferenceMarkers(fileName) !;
          let hover = ngService.getHoverAt(fileName, markers.references.chart[0].start);
          expect(hover).toBeUndefined();
        });
  });

  function hover(code: string, hoverText: string) {
    addCode(code, fileName => {
      let tests = 0;
      let markers = mockHost.getReferenceMarkers(fileName) !;
      let keys = Object.keys(markers.references).concat(Object.keys(markers.definitions));
      for (let referenceName of keys) {
        let references = (markers.references[referenceName] ||
                            []).concat(markers.definitions[referenceName] || []);
        for (let reference of references) {
          tests++;
          let hover = ngService.getHoverAt(fileName, reference.start);
          if (!hover) throw new Error(`Expected a hover at location ${reference.start}`);
          expect(hover.span).toEqual(reference);
          expect(toText(hover)).toEqual(hoverText);
        }
      }
      expect(tests).toBeGreaterThan(0);  // If this fails the test is wrong.
    });
  }

  function addCode(code: string, cb: (fileName: string, content?: string) => void) {
    let fileName = '/app/app.component.ts';
    let originalContent = mockHost.getFileContent(fileName);
    let newContent = originalContent + code;
    mockHost.override(fileName, originalContent + code);
    try {
      cb(fileName, newContent);
    } finally {
      mockHost.override(fileName, undefined !);
    }
  }

  function toText(hover: Hover): string { return hover.text.map(h => h.text).join(''); }
});
