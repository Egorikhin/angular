/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

export let $EOF = 0;
export let $BSPACE = 8;
export let $TAB = 9;
export let $LF = 10;
export let $VTAB = 11;
export let $FF = 12;
export let $CR = 13;
export let $SPACE = 32;
export let $BANG = 33;
export let $DQ = 34;
export let $HASH = 35;
export let $$ = 36;
export let $PERCENT = 37;
export let $AMPERSAND = 38;
export let $SQ = 39;
export let $LPAREN = 40;
export let $RPAREN = 41;
export let $STAR = 42;
export let $PLUS = 43;
export let $COMMA = 44;
export let $MINUS = 45;
export let $PERIOD = 46;
export let $SLASH = 47;
export let $COLON = 58;
export let $SEMICOLON = 59;
export let $LT = 60;
export let $EQ = 61;
export let $GT = 62;
export let $QUESTION = 63;

export let $0 = 48;
export let $7 = 55;
export let $9 = 57;

export let $A = 65;
export let $E = 69;
export let $F = 70;
export let $X = 88;
export let $Z = 90;

export let $LBRACKET = 91;
export let $BACKSLASH = 92;
export let $RBRACKET = 93;
export let $CARET = 94;
export let $_ = 95;

export let $a = 97;
export let $b = 98;
export let $e = 101;
export let $f = 102;
export let $n = 110;
export let $r = 114;
export let $t = 116;
export let $u = 117;
export let $v = 118;
export let $x = 120;
export let $z = 122;

export let $LBRACE = 123;
export let $BAR = 124;
export let $RBRACE = 125;
export let $NBSP = 160;

export let $PIPE = 124;
export let $TILDA = 126;
export let $AT = 64;

export let $BT = 96;

export function isWhitespace(code: number): boolean {
  return (code >= $TAB && code <= $SPACE) || (code == $NBSP);
}

export function isDigit(code: number): boolean {
  return $0 <= code && code <= $9;
}

export function isAsciiLetter(code: number): boolean {
  return code >= $a && code <= $z || code >= $A && code <= $Z;
}

export function isAsciiHexDigit(code: number): boolean {
  return code >= $a && code <= $f || code >= $A && code <= $F || isDigit(code);
}

export function isNewLine(code: number): boolean {
  return code === $LF || code === $CR;
}

export function isOctalDigit(code: number): boolean {
  return $0 <= code && code <= $7;
}
