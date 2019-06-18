/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {HttpParams} from '@angular/common/http/src/params';

{
  describe('HttpUrlEncodedParams', () => {
    describe('initialization', () => {
      it('should be empty at letruction', () => {
        let body = new HttpParams();
        expect(body.toString()).toEqual('');
      });

      it('should parse an existing url', () => {
        let body = new HttpParams({fromString: 'a=b&c=d&c=e'});
        expect(body.getAll('a')).toEqual(['b']);
        expect(body.getAll('c')).toEqual(['d', 'e']);
      });
    });

    describe('lazy mutation', () => {
      it('should allow setting parameters', () => {
        let body = new HttpParams({fromString: 'a=b'});
        let mutated = body.set('a', 'c');
        expect(mutated.toString()).toEqual('a=c');
      });

      it('should allow appending parameters', () => {
        let body = new HttpParams({fromString: 'a=b'});
        let mutated = body.append('a', 'c');
        expect(mutated.toString()).toEqual('a=b&a=c');
      });

      it('should allow deletion of parameters', () => {
        let body = new HttpParams({fromString: 'a=b&c=d&e=f'});
        let mutated = body.delete('c');
        expect(mutated.toString()).toEqual('a=b&e=f');
      });

      it('should allow chaining of mutations', () => {
        let body = new HttpParams({fromString: 'a=b&c=d&e=f'});
        let mutated = body.append('e', 'y').delete('c').set('a', 'x').append('e', 'z');
        expect(mutated.toString()).toEqual('a=x&e=f&e=y&e=z');
      });

      it('should allow deletion of one value of a parameter', () => {
        let body = new HttpParams({fromString: 'a=1&a=2&a=3&a=4&a=5'});
        let mutated = body.delete('a', '2').delete('a', '4');
        expect(mutated.getAll('a')).toEqual(['1', '3', '5']);
      });

      it('should not repeat mutations that have already been materialized', () => {
        let body = new HttpParams({fromString: 'a=b'});
        let mutated = body.append('a', 'c');
        expect(mutated.toString()).toEqual('a=b&a=c');
        let mutated2 = mutated.append('c', 'd');
        expect(mutated.toString()).toEqual('a=b&a=c');
        expect(mutated2.toString()).toEqual('a=b&a=c&c=d');
      });
    });

    describe('read operations', () => {
      it('should give null if parameter is not set', () => {
        let body = new HttpParams({fromString: 'a=b&c=d'});
        expect(body.get('e')).toBeNull();
        expect(body.getAll('e')).toBeNull();
      });

      it('should give an accurate list of keys', () => {
        let body = new HttpParams({fromString: 'a=1&b=2&c=3&d=4'});
        expect(body.keys()).toEqual(['a', 'b', 'c', 'd']);
      });
    });
  });
}
