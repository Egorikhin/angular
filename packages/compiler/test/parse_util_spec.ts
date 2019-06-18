/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ParseError, ParseErrorLevel, ParseLocation, ParseSourceFile, ParseSourceSpan} from '../src/parse_util';

{
  describe('ParseError', () => {
    it('should reflect the level in the message', () => {
      let file = new ParseSourceFile(`foo\nbar\nfoo`, 'url');
      let start = new ParseLocation(file, 4, 1, 0);
      let end = new ParseLocation(file, 6, 1, 2);
      let span = new ParseSourceSpan(start, end);

      let fatal = new ParseError(span, 'fatal', ParseErrorLevel.ERROR);
      expect(fatal.toString()).toEqual('fatal ("foo\n[ERROR ->]bar\nfoo"): url@1:0');

      let warning = new ParseError(span, 'warning', ParseErrorLevel.WARNING);
      expect(warning.toString()).toEqual('warning ("foo\n[WARNING ->]bar\nfoo"): url@1:0');
    });
  });
}