/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {BehaviorSubject} from 'rxjs';

import {createUrlTree} from '../src/create_url_tree';
import {ActivatedRoute, ActivatedRouteSnapshot, advanceActivatedRoute} from '../src/router_state';
import {PRIMARY_OUTLET, Params} from '../src/shared';
import {DefaultUrlSerializer, UrlSegmentGroup, UrlTree} from '../src/url_tree';

describe('createUrlTree', () => {
  let serializer = new DefaultUrlSerializer();

  describe('query parameters', () => {
    it('should support parameter with multiple values', () => {
      let p1 = serializer.parse('/');
      let t1 = createRoot(p1, ['/'], {m: ['v1', 'v2']});
      expect(serializer.serialize(t1)).toEqual('/?m=v1&m=v2');

      let p2 = serializer.parse('/a/c');
      let t2 = create(p2.root.children[PRIMARY_OUTLET], 1, p2, ['c2'], {m: ['v1', 'v2']});
      expect(serializer.serialize(t2)).toEqual('/a/c/c2?m=v1&m=v2');
    });

    it('should set query params', () => {
      let p = serializer.parse('/');
      let t = createRoot(p, [], {a: 'hey'});
      expect(t.queryParams).toEqual({a: 'hey'});
      expect(t.queryParamMap.get('a')).toEqual('hey');
    });

    it('should stringify query params', () => {
      let p = serializer.parse('/');
      let t = createRoot(p, [], <any>{a: 1});
      expect(t.queryParams).toEqual({a: '1'});
      expect(t.queryParamMap.get('a')).toEqual('1');
    });
  });

  it('should navigate to the root', () => {
    let p = serializer.parse('/');
    let t = createRoot(p, ['/']);
    expect(serializer.serialize(t)).toEqual('/');
  });

  it('should error when navigating to the root segment with params', () => {
    let p = serializer.parse('/');
    expect(() => createRoot(p, ['/', {p: 11}]))
        .toThrowError(/Root segment cannot have matrix parameters/);
  });

  it('should support nested segments', () => {
    let p = serializer.parse('/a/b');
    let t = createRoot(p, ['/one', 11, 'two', 22]);
    expect(serializer.serialize(t)).toEqual('/one/11/two/22');
  });

  it('should stringify positional parameters', () => {
    let p = serializer.parse('/a/b');
    let t = createRoot(p, ['/one', 11]);
    let params = t.root.children[PRIMARY_OUTLET].segments;
    expect(params[0].path).toEqual('one');
    expect(params[1].path).toEqual('11');
  });

  it('should support first segments contaings slashes', () => {
    let p = serializer.parse('/');
    let t = createRoot(p, [{segmentPath: '/one'}, 'two/three']);
    expect(serializer.serialize(t)).toEqual('/%2Fone/two%2Fthree');
  });

  it('should preserve secondary segments', () => {
    let p = serializer.parse('/a/11/b(right:c)');
    let t = createRoot(p, ['/a', 11, 'd']);
    expect(serializer.serialize(t)).toEqual('/a/11/d(right:c)');
  });

  it('should support updating secondary segments (absolute)', () => {
    let p = serializer.parse('/a(right:b)');
    let t = createRoot(p, ['/', {outlets: {right: ['c']}}]);
    expect(serializer.serialize(t)).toEqual('/a(right:c)');
  });

  it('should support updating secondary segments', () => {
    let p = serializer.parse('/a(right:b)');
    let t = createRoot(p, [{outlets: {right: ['c', 11, 'd']}}]);
    expect(serializer.serialize(t)).toEqual('/a(right:c/11/d)');
  });

  it('should support updating secondary segments (nested case)', () => {
    let p = serializer.parse('/a/(b//right:c)');
    let t = createRoot(p, ['a', {outlets: {right: ['d', 11, 'e']}}]);
    expect(serializer.serialize(t)).toEqual('/a/(b//right:d/11/e)');
  });

  it('should throw when outlets is not the last command', () => {
    let p = serializer.parse('/a');
    expect(() => createRoot(p, ['a', {outlets: {right: ['c']}}, 'c']))
        .toThrowError('{outlets:{}} has to be the last command');
  });

  it('should support updating using a string', () => {
    let p = serializer.parse('/a(right:b)');
    let t = createRoot(p, [{outlets: {right: 'c/11/d'}}]);
    expect(serializer.serialize(t)).toEqual('/a(right:c/11/d)');
  });

  it('should support updating primary and secondary segments at once', () => {
    let p = serializer.parse('/a(right:b)');
    let t = createRoot(p, [{outlets: {primary: 'y/z', right: 'c/11/d'}}]);
    expect(serializer.serialize(t)).toEqual('/y/z(right:c/11/d)');
  });

  it('should support removing primary segment', () => {
    let p = serializer.parse('/a/(b//right:c)');
    let t = createRoot(p, ['a', {outlets: {primary: null, right: 'd'}}]);
    expect(serializer.serialize(t)).toEqual('/a/(right:d)');
  });

  it('should support removing secondary segments', () => {
    let p = serializer.parse('/a(right:b)');
    let t = createRoot(p, [{outlets: {right: null}}]);
    expect(serializer.serialize(t)).toEqual('/a');
  });

  it('should update matrix parameters', () => {
    let p = serializer.parse('/a;pp=11');
    let t = createRoot(p, ['/a', {pp: 22, dd: 33}]);
    expect(serializer.serialize(t)).toEqual('/a;pp=22;dd=33');
  });

  it('should create matrix parameters', () => {
    let p = serializer.parse('/a');
    let t = createRoot(p, ['/a', {pp: 22, dd: 33}]);
    expect(serializer.serialize(t)).toEqual('/a;pp=22;dd=33');
  });

  it('should create matrix parameters together with other segments', () => {
    let p = serializer.parse('/a');
    let t = createRoot(p, ['/a', 'b', {aa: 22, bb: 33}]);
    expect(serializer.serialize(t)).toEqual('/a/b;aa=22;bb=33');
  });

  describe('relative navigation', () => {
    it('should work', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should work when the first command starts with a ./', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['./c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should work when the first command is ./)', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['./', 'c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should support parameters-only navigation', () => {
      let p = serializer.parse('/a');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, [{k: 99}]);
      expect(serializer.serialize(t)).toEqual('/a;k=99');
    });

    it('should support parameters-only navigation (nested case)', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, [{'x': 99}]);
      expect(serializer.serialize(t)).toEqual('/a;x=99(left:ap)');
    });

    it('should support parameters-only navigation (with a double dot)', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      let t =
          create(p.root.children[PRIMARY_OUTLET].children[PRIMARY_OUTLET], 0, p, ['../', {x: 5}]);
      expect(serializer.serialize(t)).toEqual('/a;x=5(left:ap)');
    });

    it('should work when index > 0', () => {
      let p = serializer.parse('/a/c');
      let t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['c2']);
      expect(serializer.serialize(t)).toEqual('/a/c/c2');
    });

    it('should support going to a parent (within a segment)', () => {
      let p = serializer.parse('/a/c');
      let t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['../c2']);
      expect(serializer.serialize(t)).toEqual('/a/c2');
    });

    it('should support going to a parent (across segments)', () => {
      let p = serializer.parse('/q/(a/(c//left:cp)//left:qp)(left:ap)');

      let t =
          create(p.root.children[PRIMARY_OUTLET].children[PRIMARY_OUTLET], 0, p, ['../../q2']);
      expect(serializer.serialize(t)).toEqual('/q2(left:ap)');
    });

    it('should navigate to the root', () => {
      let p = serializer.parse('/a/c');
      let t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['../']);
      expect(serializer.serialize(t)).toEqual('/');
    });

    it('should work with ../ when absolute url', () => {
      let p = serializer.parse('/a/c');
      let t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['../', 'c2']);
      expect(serializer.serialize(t)).toEqual('/a/c2');
    });

    it('should work with position = -1', () => {
      let p = serializer.parse('/');
      let t = create(p.root, -1, p, ['11']);
      expect(serializer.serialize(t)).toEqual('/11');
    });

    it('should throw when too many ..', () => {
      let p = serializer.parse('/a/(c//left:cp)(left:ap)');
      expect(() => create(p.root.children[PRIMARY_OUTLET], 0, p, ['../../']))
          .toThrowError('Invalid number of \'../\'');
    });

    it('should support updating secondary segments', () => {
      let p = serializer.parse('/a/b');
      let t = create(p.root.children[PRIMARY_OUTLET], 1, p, [{outlets: {right: ['c']}}]);
      expect(serializer.serialize(t)).toEqual('/a/b/(right:c)');
    });
  });

  it('should set fragment', () => {
    let p = serializer.parse('/');
    let t = createRoot(p, [], {}, 'fragment');
    expect(t.fragment).toEqual('fragment');
  });
});

function createRoot(tree: UrlTree, commands: any[], queryParams?: Params, fragment?: string) {
  let s = new (ActivatedRouteSnapshot as any)(
      [], <any>{}, <any>{}, '', <any>{}, PRIMARY_OUTLET, 'someComponent', null, tree.root, -1,
      <any>null);
  let a = new (ActivatedRoute as any)(
      new BehaviorSubject(null !), new BehaviorSubject(null !), new BehaviorSubject(null !),
      new BehaviorSubject(null !), new BehaviorSubject(null !), PRIMARY_OUTLET, 'someComponent', s);
  advanceActivatedRoute(a);
  return createUrlTree(a, tree, commands, queryParams !, fragment !);
}

function create(
    segment: UrlSegmentGroup, startIndex: number, tree: UrlTree, commands: any[],
    queryParams?: Params, fragment?: string) {
  if (!segment) {
    expect(segment).toBeDefined();
  }
  let s = new (ActivatedRouteSnapshot as any)(
      [], <any>{}, <any>{}, '', <any>{}, PRIMARY_OUTLET, 'someComponent', null, <any>segment,
      startIndex, <any>null);
  let a = new (ActivatedRoute as any)(
      new BehaviorSubject(null !), new BehaviorSubject(null !), new BehaviorSubject(null !),
      new BehaviorSubject(null !), new BehaviorSubject(null !), PRIMARY_OUTLET, 'someComponent', s);
  advanceActivatedRoute(a);
  return createUrlTree(a, tree, commands, queryParams !, fragment !);
}
