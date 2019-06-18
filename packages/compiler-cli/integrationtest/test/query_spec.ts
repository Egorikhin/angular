/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import './init';
import {QueryList} from '@angular/core';
import {By} from '@angular/platform-browser';
import {CompForChildQuery, CompWithChildQuery} from '../src/queries';
import {createComponent} from './util';

describe('child queries', () => {
  it('should support compiling child queries', () => {
    let childQueryCompFixture = createComponent(CompWithChildQuery);
    let debugElement = childQueryCompFixture.debugElement;
    debugElement.query(By.directive(CompWithChildQuery));
    expect(childQueryCompFixture.componentInstance.child).toBeDefined();
    expect(childQueryCompFixture.componentInstance.child instanceof CompForChildQuery).toBe(true);

  });

  it('should support compiling children queries', () => {
    let childQueryCompFixture = createComponent(CompWithChildQuery);
    let debugElement = childQueryCompFixture.debugElement;
    debugElement.query(By.directive(CompWithChildQuery));

    childQueryCompFixture.detectChanges();

    expect(childQueryCompFixture.componentInstance.children).toBeDefined();
    expect(childQueryCompFixture.componentInstance.children instanceof QueryList).toBe(true);
  });
});
