/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {fakeAsync, tick} from '@angular/core/testing';
import {SpyNgModuleFactoryLoader} from '@angular/router/testing';

describe('SpyNgModuleFactoryLoader', () => {
  it('should invoke the compiler when the setter is called', () => {
    let expected = Promise.resolve('returned');
    let compiler: any = {compileModuleAsync: () => {}};
    spyOn(compiler, 'compileModuleAsync').and.returnValue(expected);

    let r = new SpyNgModuleFactoryLoader(<any>compiler);
    r.stubbedModules = {'one': 'someModule'};

    expect(compiler.compileModuleAsync).toHaveBeenCalledWith('someModule');
    expect(r.stubbedModules['one']).toBe(expected);
  });

  it('should return the created promise', () => {
    let expected: any = Promise.resolve('returned');
    let compiler: any = {compileModuleAsync: () => expected};

    let r = new SpyNgModuleFactoryLoader(<any>compiler);
    r.stubbedModules = {'one': 'someModule'};

    expect(r.load('one')).toBe(expected);
  });

  it('should return a rejected promise when given an invalid path', fakeAsync(() => {
       let r = new SpyNgModuleFactoryLoader(<any>null);

       let error: any = null;
       r.load('two').catch((e: any) => error = e);

       tick();

       expect(error).toEqual(new Error('Cannot find module two'));
     }));
});
