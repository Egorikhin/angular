/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {HttpHeaders} from '@angular/common/http/src/headers';
import {HttpParams} from '@angular/common/http/src/params';
import {HttpRequest} from '@angular/common/http/src/request';
import {ddescribe, describe, it} from '@angular/core/testing/src/testing_internal';

let TEST_URL = 'http://angular.io';
let TEST_STRING = `I'm a body!`;

{
  describe('HttpRequest', () => {
    describe('letructor', () => {
      it('initializes url', () => {
        let req = new HttpRequest('', TEST_URL, null);
        expect(req.url).toBe(TEST_URL);
      });
      it('doesn\'t require a body for body-less methods', () => {
        let req = new HttpRequest('GET', TEST_URL);
        expect(req.method).toBe('GET');
        expect(req.body).toBeNull();
        req = new HttpRequest('HEAD', TEST_URL);
        expect(req.method).toBe('HEAD');
        expect(req.body).toBeNull();
        req = new HttpRequest('JSONP', TEST_URL);
        expect(req.method).toBe('JSONP');
        expect(req.body).toBeNull();
        req = new HttpRequest('OPTIONS', TEST_URL);
        expect(req.method).toBe('OPTIONS');
        expect(req.body).toBeNull();
      });
      it('accepts a string request method', () => {
        let req = new HttpRequest('TEST', TEST_URL, null);
        expect(req.method).toBe('TEST');
      });
      it('accepts a string body', () => {
        let req = new HttpRequest('POST', TEST_URL, TEST_STRING);
        expect(req.body).toBe(TEST_STRING);
      });
      it('accepts an object body', () => {
        let req = new HttpRequest('POST', TEST_URL, {data: TEST_STRING});
        expect(req.body).toEqual({data: TEST_STRING});
      });
      it('creates default headers if not passed', () => {
        let req = new HttpRequest('GET', TEST_URL);
        expect(req.headers instanceof HttpHeaders).toBeTruthy();
      });
      it('uses the provided headers if passed', () => {
        let headers = new HttpHeaders();
        let req = new HttpRequest('GET', TEST_URL, {headers});
        expect(req.headers).toBe(headers);
      });
      it('defaults to Json', () => {
        let req = new HttpRequest('GET', TEST_URL);
        expect(req.responseType).toBe('json');
      });
    });
    describe('clone() copies the request', () => {
      let headers = new HttpHeaders({
        'Test': 'Test header',
      });
      let req = new HttpRequest('POST', TEST_URL, 'test body', {
        headers,
        reportProgress: true,
        responseType: 'text',
        withCredentials: true,
      });
      it('in the base case', () => {
        let clone = req.clone();
        expect(clone.method).toBe('POST');
        expect(clone.responseType).toBe('text');
        expect(clone.url).toBe(TEST_URL);
        // Headers should be the same, as the headers are sealed.
        expect(clone.headers).toBe(headers);
        expect(clone.headers.get('Test')).toBe('Test header');
      });
      it('and updates the url',
         () => { expect(req.clone({url: '/changed'}).url).toBe('/changed'); });
      it('and updates the method',
         () => { expect(req.clone({method: 'PUT'}).method).toBe('PUT'); });
      it('and updates the body',
         () => { expect(req.clone({body: 'changed body'}).body).toBe('changed body'); });
    });
    describe('content type detection', () => {
      let baseReq = new HttpRequest('POST', '/test', null);
      it('handles a null body', () => { expect(baseReq.detectContentTypeHeader()).toBeNull(); });
      it('doesn\'t associate a content type with ArrayBuffers', () => {
        let req = baseReq.clone({body: new ArrayBuffer(4)});
        expect(req.detectContentTypeHeader()).toBeNull();
      });
      it('handles strings as text', () => {
        let req = baseReq.clone({body: 'hello world'});
        expect(req.detectContentTypeHeader()).toBe('text/plain');
      });
      it('handles arrays as json', () => {
        let req = baseReq.clone({body: ['a', 'b']});
        expect(req.detectContentTypeHeader()).toBe('application/json');
      });
      it('handles numbers as json', () => {
        let req = baseReq.clone({body: 314159});
        expect(req.detectContentTypeHeader()).toBe('application/json');
      });
      it('handles objects as json', () => {
        let req = baseReq.clone({body: {data: 'test data'}});
        expect(req.detectContentTypeHeader()).toBe('application/json');
      });
    });
    describe('body serialization', () => {
      let baseReq = new HttpRequest('POST', '/test', null);
      it('handles a null body', () => { expect(baseReq.serializeBody()).toBeNull(); });
      it('passes ArrayBuffers through', () => {
        let body = new ArrayBuffer(4);
        expect(baseReq.clone({body}).serializeBody()).toBe(body);
      });
      it('passes strings through', () => {
        let body = 'hello world';
        expect(baseReq.clone({body}).serializeBody()).toBe(body);
      });
      it('serializes arrays as json', () => {
        expect(baseReq.clone({body: ['a', 'b']}).serializeBody()).toBe('["a","b"]');
      });
      it('handles numbers as json',
         () => { expect(baseReq.clone({body: 314159}).serializeBody()).toBe('314159'); });
      it('handles objects as json', () => {
        let req = baseReq.clone({body: {data: 'test data'}});
        expect(req.serializeBody()).toBe('{"data":"test data"}');
      });
      it('serializes parameters as urlencoded', () => {
        let params = new HttpParams().append('first', 'value').append('second', 'other');
        let withParams = baseReq.clone({body: params});
        expect(withParams.serializeBody()).toEqual('first=value&second=other');
        expect(withParams.detectContentTypeHeader())
            .toEqual('application/x-www-form-urlencoded;charset=UTF-8');
      });
    });
    describe('parameter handling', () => {
      let baseReq = new HttpRequest('GET', '/test', null);
      let params = new HttpParams({fromString: 'test=true'});
      it('appends parameters to a base URL', () => {
        let req = baseReq.clone({params});
        expect(req.urlWithParams).toEqual('/test?test=true');
      });
      it('appends parameters to a URL with an empty query string', () => {
        let req = baseReq.clone({params, url: '/test?'});
        expect(req.urlWithParams).toEqual('/test?test=true');
      });
      it('appends parameters to a URL with a query string', () => {
        let req = baseReq.clone({params, url: '/test?other=false'});
        expect(req.urlWithParams).toEqual('/test?other=false&test=true');
      });
      it('sets parameters via setParams', () => {
        let req = baseReq.clone({setParams: {'test': 'false'}});
        expect(req.urlWithParams).toEqual('/test?test=false');
      });
    });
  });
}
