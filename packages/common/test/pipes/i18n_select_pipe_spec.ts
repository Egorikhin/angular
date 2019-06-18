/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {I18nSelectPipe} from '@angular/common';
import {PipeResolver} from '@angular/compiler/src/pipe_resolver';
import {JitReflector} from '@angular/platform-browser-dynamic/src/compiler_reflector';

{
  describe('I18nSelectPipe', () => {
    let pipe: I18nSelectPipe = new I18nSelectPipe();
    let mapping = {'male': 'Invite him.', 'female': 'Invite her.', 'other': 'Invite them.'};

    it('should be marked as pure', () => {
      expect(new PipeResolver(new JitReflector()).resolve(I18nSelectPipe) !.pure).toEqual(true);
    });

    describe('transform', () => {
      it('should return the "male" text if value is "male"', () => {
        let val = pipe.transform('male', mapping);
        expect(val).toEqual('Invite him.');
      });

      it('should return the "female" text if value is "female"', () => {
        let val = pipe.transform('female', mapping);
        expect(val).toEqual('Invite her.');
      });

      it('should return the "other" text if value is neither "male" nor "female"',
         () => { expect(pipe.transform('Anything else', mapping)).toEqual('Invite them.'); });

      it('should return an empty text if value is null or undefined', () => {
        expect(pipe.transform(null, mapping)).toEqual('');
        expect(pipe.transform(void 0, mapping)).toEqual('');
      });

      it('should throw on bad arguments',
         () => { expect(() => pipe.transform('male', <any>'hey')).toThrowError(); });
    });

  });
}
