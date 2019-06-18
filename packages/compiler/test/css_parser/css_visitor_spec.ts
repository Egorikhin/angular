/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import {beforeEach, describe, expect, it} from '../../../core/testing/src/testing_internal';
import {CssAst, CssAstVisitor, CssAtRulePredicateAst, CssBlockAst, CssDefinitionAst, CssInlineRuleAst, CssKeyframeDefinitionAst, CssKeyframeRuleAst, CssMediaQueryRuleAst, CssPseudoSelectorAst, CssRuleAst, CssSelectorAst, CssSelectorRuleAst, CssSimpleSelectorAst, CssStyleSheetAst, CssStyleValueAst, CssStylesBlockAst, CssUnknownRuleAst, CssUnknownTokenListAst} from '../../src/css_parser/css_ast';
import {BlockType, CssParseError, CssParser, CssToken} from '../../src/css_parser/css_parser';

function _assertTokens(tokens: CssToken[], valuesArr: string[]): void {
  expect(tokens.length).toEqual(valuesArr.length);
  for (let i = 0; i < tokens.length; i++) {
    expect(tokens[i].strValue == valuesArr[i]);
  }
}

class MyVisitor implements CssAstVisitor {
  captures: {[key: string]: any[]} = {};

  /**
   * @internal
   */
  _capture(method: string, ast: CssAst, context: any) {
    this.captures[method] = this.captures[method] || [];
    this.captures[method].push([ast, context]);
  }

  letructor(ast: CssStyleSheetAst, context: any) { ast.visit(this, context); }

  visitCssValue(ast: CssStyleValueAst, context: any): void {
    this._capture('visitCssValue', ast, context);
  }

  visitCssInlineRule(ast: CssInlineRuleAst, context: any): void {
    this._capture('visitCssInlineRule', ast, context);
  }

  visitCssAtRulePredicate(ast: CssAtRulePredicateAst, context: any): void {
    this._capture('visitCssAtRulePredicate', ast, context);
  }

  visitCssKeyframeRule(ast: CssKeyframeRuleAst, context: any): void {
    this._capture('visitCssKeyframeRule', ast, context);
    ast.block.visit(this, context);
  }

  visitCssKeyframeDefinition(ast: CssKeyframeDefinitionAst, context: any): void {
    this._capture('visitCssKeyframeDefinition', ast, context);
    ast.block.visit(this, context);
  }

  visitCssMediaQueryRule(ast: CssMediaQueryRuleAst, context: any): void {
    this._capture('visitCssMediaQueryRule', ast, context);
    ast.query.visit(this, context);
    ast.block.visit(this, context);
  }

  visitCssSelectorRule(ast: CssSelectorRuleAst, context: any): void {
    this._capture('visitCssSelectorRule', ast, context);
    ast.selectors.forEach((selAst: CssSelectorAst) => { selAst.visit(this, context); });
    ast.block.visit(this, context);
  }

  visitCssSelector(ast: CssSelectorAst, context: any): void {
    this._capture('visitCssSelector', ast, context);
    ast.selectorParts.forEach(
        (simpleAst: CssSimpleSelectorAst) => { simpleAst.visit(this, context); });
  }

  visitCssSimpleSelector(ast: CssSimpleSelectorAst, context: any): void {
    this._capture('visitCssSimpleSelector', ast, context);
    ast.pseudoSelectors.forEach(
        (pseudoAst: CssPseudoSelectorAst) => { pseudoAst.visit(this, context); });
  }

  visitCssDefinition(ast: CssDefinitionAst, context: any): void {
    this._capture('visitCssDefinition', ast, context);
    ast.value.visit(this, context);
  }

  visitCssBlock(ast: CssBlockAst, context: any): void {
    this._capture('visitCssBlock', ast, context);
    ast.entries.forEach((entryAst: CssAst) => { entryAst.visit(this, context); });
  }

  visitCssStylesBlock(ast: CssStylesBlockAst, context: any): void {
    this._capture('visitCssStylesBlock', ast, context);
    ast.definitions.forEach(
        (definitionAst: CssDefinitionAst) => { definitionAst.visit(this, context); });
  }

  visitCssStyleSheet(ast: CssStyleSheetAst, context: any): void {
    this._capture('visitCssStyleSheet', ast, context);
    ast.rules.forEach((ruleAst: CssRuleAst) => { ruleAst.visit(this, context); });
  }

  visitCssUnknownRule(ast: CssUnknownRuleAst, context: any): void {
    this._capture('visitCssUnknownRule', ast, context);
  }

  visitCssUnknownTokenList(ast: CssUnknownTokenListAst, context: any): void {
    this._capture('visitCssUnknownTokenList', ast, context);
  }

  visitCssPseudoSelector(ast: CssPseudoSelectorAst, context: any): void {
    this._capture('visitCssPseudoSelector', ast, context);
  }
}

function _getCaptureAst(capture: any[], index = 0): CssAst {
  return <CssAst>capture[index][0];
}

(function() {
  function parse(cssCode: string, ignoreErrors: boolean = false) {
    let output = new CssParser().parse(cssCode, 'some-fake-css-file.css');
    let errors = output.errors;
    if (errors.length > 0 && !ignoreErrors) {
      throw new Error(errors.map((error: CssParseError) => error.msg).join(', '));
    }
    return output.ast;
  }

  describe('CSS parsing and visiting', () => {
    let ast: CssStyleSheetAst;
    let context = {};

    beforeEach(() => {
      let cssCode = `
        .rule1 { prop1: value1 }
        .rule2 { prop2: value2 }

        @media all (max-width: 100px) {
          #id { prop3 :value3; }
        }

        @import url(file.css);

        @keyframes rotate {
          from {
            prop4: value4;
          }
          50%, 100% {
            prop5: value5;
          }
        }
      `;
      ast = parse(cssCode);
    });

    it('should parse and visit a stylesheet', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssStyleSheet'];

      expect(captures.length).toEqual(1);

      let capture = captures[0];
      expect(capture[0]).toEqual(ast);
      expect(capture[1]).toEqual(context);
    });

    it('should parse and visit each of the stylesheet selectors', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssSelectorRule'];

      expect(captures.length).toEqual(3);

      let rule1 = <CssSelectorRuleAst>_getCaptureAst(captures, 0);
      expect(rule1).toEqual(ast.rules[0] as CssSelectorRuleAst);

      let firstSelector = rule1.selectors[0];
      let firstSimpleSelector = firstSelector.selectorParts[0];
      _assertTokens(firstSimpleSelector.tokens, ['.', 'rule1']);

      let rule2 = <CssSelectorRuleAst>_getCaptureAst(captures, 1);
      expect(rule2).toEqual(ast.rules[1] as CssSelectorRuleAst);

      let secondSelector = rule2.selectors[0];
      let secondSimpleSelector = secondSelector.selectorParts[0];
      _assertTokens(secondSimpleSelector.tokens, ['.', 'rule2']);

      let rule3 = <CssSelectorRuleAst>_getCaptureAst(captures, 2);
      expect(rule3).toEqual(
          (ast.rules[2] as CssSelectorRuleAst).block.entries[0] as CssSelectorRuleAst);

      let thirdSelector = rule3.selectors[0];
      let thirdSimpleSelector = thirdSelector.selectorParts[0];
      _assertTokens(thirdSimpleSelector.tokens, ['#', 'rule3']);
    });

    it('should parse and visit each of the stylesheet style key/value definitions', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssDefinition'];

      expect(captures.length).toEqual(5);

      let def1 = <CssDefinitionAst>_getCaptureAst(captures, 0);
      expect(def1.property.strValue).toEqual('prop1');
      expect(def1.value.tokens[0].strValue).toEqual('value1');

      let def2 = <CssDefinitionAst>_getCaptureAst(captures, 1);
      expect(def2.property.strValue).toEqual('prop2');
      expect(def2.value.tokens[0].strValue).toEqual('value2');

      let def3 = <CssDefinitionAst>_getCaptureAst(captures, 2);
      expect(def3.property.strValue).toEqual('prop3');
      expect(def3.value.tokens[0].strValue).toEqual('value3');

      let def4 = <CssDefinitionAst>_getCaptureAst(captures, 3);
      expect(def4.property.strValue).toEqual('prop4');
      expect(def4.value.tokens[0].strValue).toEqual('value4');

      let def5 = <CssDefinitionAst>_getCaptureAst(captures, 4);
      expect(def5.property.strValue).toEqual('prop5');
      expect(def5.value.tokens[0].strValue).toEqual('value5');
    });

    it('should parse and visit the associated media query values', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssMediaQueryRule'];

      expect(captures.length).toEqual(1);

      let query1 = <CssMediaQueryRuleAst>_getCaptureAst(captures, 0);
      _assertTokens(query1.query.tokens, ['all', 'and', '(', 'max-width', '100', 'px', ')']);
      expect(query1.block.entries.length).toEqual(1);
    });

    it('should capture the media query predicate', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssAtRulePredicate'];

      expect(captures.length).toEqual(1);

      let predicate = <CssAtRulePredicateAst>_getCaptureAst(captures, 0);
      expect(predicate.strValue).toEqual('@media all (max-width: 100px)');
    });

    it('should parse and visit the associated "@inline" rule values', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssInlineRule'];

      expect(captures.length).toEqual(1);

      let inline1 = <CssInlineRuleAst>_getCaptureAst(captures, 0);
      expect(inline1.type).toEqual(BlockType.Import);
      _assertTokens(inline1.value.tokens, ['url', '(', 'file.css', ')']);
    });

    it('should parse and visit the keyframe blocks', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssKeyframeRule'];

      expect(captures.length).toEqual(1);

      let keyframe1 = <CssKeyframeRuleAst>_getCaptureAst(captures, 0);
      expect(keyframe1.name !.strValue).toEqual('rotate');
      expect(keyframe1.block.entries.length).toEqual(2);
    });

    it('should parse and visit the associated keyframe rules', () => {
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssKeyframeDefinition'];

      expect(captures.length).toEqual(2);

      let def1 = <CssKeyframeDefinitionAst>_getCaptureAst(captures, 0);
      _assertTokens(def1.steps, ['from']);
      expect(def1.block.entries.length).toEqual(1);

      let def2 = <CssKeyframeDefinitionAst>_getCaptureAst(captures, 1);
      _assertTokens(def2.steps, ['50%', '100%']);
      expect(def2.block.entries.length).toEqual(1);
    });

    it('should visit an unknown `@` rule', () => {
      let cssCode = `
        @someUnknownRule param {
          one two three
        }
      `;
      ast = parse(cssCode, true);
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssUnknownRule'];

      expect(captures.length).toEqual(1);

      let rule = <CssUnknownRuleAst>_getCaptureAst(captures, 0);
      expect(rule.ruleName).toEqual('@someUnknownRule');

      _assertTokens(rule.tokens, ['param', '{', 'one', 'two', 'three', '}']);
    });

    it('should collect an invalid list of tokens before a valid selector', () => {
      let cssCode = 'one two three four five; selector { }';
      ast = parse(cssCode, true);
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssUnknownTokenList'];

      expect(captures.length).toEqual(1);

      let rule = <CssUnknownTokenListAst>_getCaptureAst(captures, 0);
      _assertTokens(rule.tokens, ['one', 'two', 'three', 'four', 'five']);
    });

    it('should collect an invalid list of tokens after a valid selector', () => {
      let cssCode = 'selector { } six seven eight';
      ast = parse(cssCode, true);
      let visitor = new MyVisitor(ast, context);
      let captures = visitor.captures['visitCssUnknownTokenList'];

      expect(captures.length).toEqual(1);

      let rule = <CssUnknownTokenListAst>_getCaptureAst(captures, 0);
      _assertTokens(rule.tokens, ['six', 'seven', 'eight']);
    });
  });
})();
