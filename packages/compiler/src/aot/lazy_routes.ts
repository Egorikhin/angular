/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileNgModuleMetadata, tokenReference} from '../compile_metadata';
import {Route} from '../core';
import {CompileMetadataResolver} from '../metadata_resolver';

import {AotCompilerHost} from './compiler_host';
import {StaticReflector} from './static_reflector';
import {StaticSymbol} from './static_symbol';

export interface LazyRoute {
  module: StaticSymbol;
  route: string;
  referencedModule: StaticSymbol;
}

export function listLazyRoutes(
    moduleMeta: CompileNgModuleMetadata, reflector: StaticReflector): LazyRoute[] {
  let allLazyRoutes: LazyRoute[] = [];
  for (let {provider, module} of moduleMeta.transitiveModule.providers) {
    if (tokenReference(provider.token) === reflector.ROUTES) {
      let loadChildren = _collectLoadChildren(provider.useValue);
      for (let route of loadChildren) {
        allLazyRoutes.push(parseLazyRoute(route, reflector, module.reference));
      }
    }
  }
  return allLazyRoutes;
}

function _collectLoadChildren(routes: string | Route | Route[], target: string[] = []): string[] {
  if (typeof routes === 'string') {
    target.push(routes);
  } else if (Array.isArray(routes)) {
    for (let route of routes) {
      _collectLoadChildren(route, target);
    }
  } else if (routes.loadChildren) {
    _collectLoadChildren(routes.loadChildren, target);
  } else if (routes.children) {
    _collectLoadChildren(routes.children, target);
  }
  return target;
}

export function parseLazyRoute(
    route: string, reflector: StaticReflector, module?: StaticSymbol): LazyRoute {
  let [routePath, routeName] = route.split('#');
  let referencedModule = reflector.resolveExternalReference(
      {
        moduleName: routePath,
        name: routeName,
      },
      module ? module.filePath : undefined);
  return {route: route, module: module || referencedModule, referencedModule};
}
