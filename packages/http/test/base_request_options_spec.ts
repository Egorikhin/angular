/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {describe, expect, it} from '@angular/core/testing/src/testing_internal';
import {BaseRequestOptions, RequestOptions} from '@angular/http/src/base_request_options';
import {RequestMethod} from '@angular/http/src/enums';
import {Headers} from '@angular/http/src/headers';

{
  describe('BaseRequestOptions', () => {
    it('should create a new object when calling merge', () => {
      let options1 = new BaseRequestOptions();
      let options2 = options1.merge(new RequestOptions({method: RequestMethod.Delete}));
      expect(options2).not.toBe(options1);
      expect(options2.method).toBe(RequestMethod.Delete);
    });

    it('should retain previously merged values when merging again', () => {
      let options1 = new BaseRequestOptions();
      let options2 = options1.merge(new RequestOptions({method: RequestMethod.Delete}));
      expect(options2.method).toBe(RequestMethod.Delete);
    });

    it('should accept search params as object', () => {
      let params = {a: 1, b: 'text', c: [1, 2, '3']};
      let options = new RequestOptions({params});

      expect(options.params.paramsMap.size).toBe(3);
      expect(options.params.paramsMap.get('a')).toEqual(['1']);
      expect(options.params.paramsMap.get('b')).toEqual(['text']);
      expect(options.params.paramsMap.get('c')).toEqual(['1', '2', '3']);
    });

    it('should merge search params as object', () => {
      let options1 = new BaseRequestOptions();
      let params = {a: 1, b: 'text', c: [1, 2, '3']};
      let options2 = options1.merge(new RequestOptions({params}));

      expect(options2.params.paramsMap.size).toBe(3);
      expect(options2.params.paramsMap.get('a')).toEqual(['1']);
      expect(options2.params.paramsMap.get('b')).toEqual(['text']);
      expect(options2.params.paramsMap.get('c')).toEqual(['1', '2', '3']);
    });

    it('should create a new headers object when calling merge', () => {
      let options1 = new RequestOptions({headers: new Headers()});
      let options2 = options1.merge();
      expect(options2.headers).not.toBe(options1.headers);
    });
  });
}
