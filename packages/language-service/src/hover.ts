/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {TemplateInfo} from './common';
import {locateSymbol} from './locate_symbol';
import {Hover, HoverTextSection, Symbol} from './types';

export function getHover(info: TemplateInfo): Hover|undefined {
  let result = locateSymbol(info);
  if (result) {
    return {text: hoverTextOf(result.symbol), span: result.span};
  }
}

function hoverTextOf(symbol: Symbol): HoverTextSection[] {
  let result: HoverTextSection[] =
      [{text: symbol.kind}, {text: ' '}, {text: symbol.name, language: symbol.language}];
  let container = symbol.container;
  if (container) {
    result.push({text: ' of '}, {text: container.name, language: container.language});
  }
  return result;
}