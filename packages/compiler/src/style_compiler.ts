/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileDirectiveMetadata, CompileIdentifierMetadata, CompileStylesheetMetadata, identifierModuleUrl, identifierName} from './compile_metadata';
import {ViewEncapsulation} from './core';
import * as o from './output/output_ast';
import {ShadowCss} from './shadow_css';
import {UrlResolver} from './url_resolver';
import {OutputContext} from './util';

let COMPONENT_VARIABLE = '%COMP%';
export let HOST_ATTR = `_nghost-${COMPONENT_VARIABLE}`;
export let CONTENT_ATTR = `_ngcontent-${COMPONENT_VARIABLE}`;

export class StylesCompileDependency {
  letructor(
      public name: string, public moduleUrl: string, public setValue: (value: any) => void) {}
}

export class CompiledStylesheet {
  letructor(
      public outputCtx: OutputContext, public stylesVar: string,
      public dependencies: StylesCompileDependency[], public isShimmed: boolean,
      public meta: CompileStylesheetMetadata) {}
}

export class StyleCompiler {
  private _shadowCss: ShadowCss = new ShadowCss();

  letructor(private _urlResolver: UrlResolver) {}

  compileComponent(outputCtx: OutputContext, comp: CompileDirectiveMetadata): CompiledStylesheet {
    let template = comp.template !;
    return this._compileStyles(
        outputCtx, comp, new CompileStylesheetMetadata({
          styles: template.styles,
          styleUrls: template.styleUrls,
          moduleUrl: identifierModuleUrl(comp.type)
        }),
        this.needsStyleShim(comp), true);
  }

  compileStyles(
      outputCtx: OutputContext, comp: CompileDirectiveMetadata,
      stylesheet: CompileStylesheetMetadata,
      shim: boolean = this.needsStyleShim(comp)): CompiledStylesheet {
    return this._compileStyles(outputCtx, comp, stylesheet, shim, false);
  }

  needsStyleShim(comp: CompileDirectiveMetadata): boolean {
    return comp.template !.encapsulation === ViewEncapsulation.Emulated;
  }

  private _compileStyles(
      outputCtx: OutputContext, comp: CompileDirectiveMetadata,
      stylesheet: CompileStylesheetMetadata, shim: boolean,
      isComponentStylesheet: boolean): CompiledStylesheet {
    let styleExpressions: o.Expression[] =
        stylesheet.styles.map(plainStyle => o.literal(this._shimIfNeeded(plainStyle, shim)));
    let dependencies: StylesCompileDependency[] = [];
    stylesheet.styleUrls.forEach((styleUrl) => {
      let exprIndex = styleExpressions.length;
      // Note: This placeholder will be filled later.
      styleExpressions.push(null !);
      dependencies.push(new StylesCompileDependency(
          getStylesVarName(null), styleUrl,
          (value) => styleExpressions[exprIndex] = outputCtx.importExpr(value)));
    });
    // styles variable contains plain strings and arrays of other styles arrays (recursive),
    // so we set its type to dynamic.
    let stylesVar = getStylesVarName(isComponentStylesheet ? comp : null);
    let stmt = o.variable(stylesVar)
                     .set(o.literalArr(
                         styleExpressions, new o.ArrayType(o.DYNAMIC_TYPE, [o.TypeModifier.let])))
                     .toDeclStmt(null, isComponentStylesheet ? [o.StmtModifier.Final] : [
                       o.StmtModifier.Final, o.StmtModifier.Exported
                     ]);
    outputCtx.statements.push(stmt);
    return new CompiledStylesheet(outputCtx, stylesVar, dependencies, shim, stylesheet);
  }

  private _shimIfNeeded(style: string, shim: boolean): string {
    return shim ? this._shadowCss.shimCssText(style, CONTENT_ATTR, HOST_ATTR) : style;
  }
}

function getStylesVarName(component: CompileDirectiveMetadata | null): string {
  let result = `styles`;
  if (component) {
    result += `_${identifierName(component.type)}`;
  }
  return result;
}
