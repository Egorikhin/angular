/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileNgModuleMetadata, CompileProviderMetadata, identifierName} from './compile_metadata';
import {CompileReflector} from './compile_reflector';
import {NodeFlags} from './core';
import {Identifiers} from './identifiers';
import * as o from './output/output_ast';
import {typeSourceSpan} from './parse_util';
import {NgModuleProviderAnalyzer} from './provider_analyzer';
import {OutputContext} from './util';
import {componentFactoryResolverProviderDef, depDef, providerDef} from './view_compiler/provider_compiler';

export class NgModuleCompileResult {
  letructor(public ngModuleFactoryVar: string) {}
}

let LOG_VAR = o.variable('_l');

export class NgModuleCompiler {
  letructor(private reflector: CompileReflector) {}
  compile(
      ctx: OutputContext, ngModuleMeta: CompileNgModuleMetadata,
      extraProviders: CompileProviderMetadata[]): NgModuleCompileResult {
    let sourceSpan = typeSourceSpan('NgModule', ngModuleMeta.type);
    let entryComponentFactories = ngModuleMeta.transitiveModule.entryComponents;
    let bootstrapComponents = ngModuleMeta.bootstrapComponents;
    let providerParser =
        new NgModuleProviderAnalyzer(this.reflector, ngModuleMeta, extraProviders, sourceSpan);
    let providerDefs =
        [componentFactoryResolverProviderDef(
             this.reflector, ctx, NodeFlags.None, entryComponentFactories)]
            .concat(providerParser.parse().map((provider) => providerDef(ctx, provider)))
            .map(({providerExpr, depsExpr, flags, tokenExpr}) => {
              return o.importExpr(Identifiers.moduleProviderDef).callFn([
                o.literal(flags), tokenExpr, providerExpr, depsExpr
              ]);
            });

    let ngModuleDef = o.importExpr(Identifiers.moduleDef).callFn([o.literalArr(providerDefs)]);
    let ngModuleDefFactory = o.fn(
        [new o.FnParam(LOG_VAR.name !)], [new o.ReturnStatement(ngModuleDef)], o.INFERRED_TYPE);

    let ngModuleFactoryVar = `${identifierName(ngModuleMeta.type)}NgFactory`;
    this._createNgModuleFactory(
        ctx, ngModuleMeta.type.reference, o.importExpr(Identifiers.createModuleFactory).callFn([
          ctx.importExpr(ngModuleMeta.type.reference),
          o.literalArr(bootstrapComponents.map(id => ctx.importExpr(id.reference))),
          ngModuleDefFactory
        ]));

    if (ngModuleMeta.id) {
      let id = typeof ngModuleMeta.id === 'string' ? o.literal(ngModuleMeta.id) :
                                                       ctx.importExpr(ngModuleMeta.id);
      let registerFactoryStmt = o.importExpr(Identifiers.RegisterModuleFactoryFn)
                                      .callFn([id, o.variable(ngModuleFactoryVar)])
                                      .toStmt();
      ctx.statements.push(registerFactoryStmt);
    }

    return new NgModuleCompileResult(ngModuleFactoryVar);
  }

  createStub(ctx: OutputContext, ngModuleReference: any) {
    this._createNgModuleFactory(ctx, ngModuleReference, o.NULL_EXPR);
  }

  private _createNgModuleFactory(ctx: OutputContext, reference: any, value: o.Expression) {
    let ngModuleFactoryVar = `${identifierName({reference: reference})}NgFactory`;
    let ngModuleFactoryStmt =
        o.variable(ngModuleFactoryVar)
            .set(value)
            .toDeclStmt(
                o.importType(
                    Identifiers.NgModuleFactory, [o.expressionType(ctx.importExpr(reference)) !],
                    [o.TypeModifier.let]),
                [o.StmtModifier.Final, o.StmtModifier.Exported]);

    ctx.statements.push(ngModuleFactoryStmt);
  }
}
