/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {trigger} from '@angular/animations';

import {TriggerAst} from '../src/dsl/animation_ast';
import {buildAnimationAst} from '../src/dsl/animation_ast_builder';
import {AnimationTrigger, buildTrigger} from '../src/dsl/animation_trigger';
import {MockAnimationDriver} from '../testing/src/mock_animation_driver';

export function makeTrigger(
    name: string, steps: any, skipErrors: boolean = false): AnimationTrigger {
  let driver = new MockAnimationDriver();
  let errors: any[] = [];
  let triggerData = trigger(name, steps);
  let triggerAst = buildAnimationAst(driver, triggerData, errors) as TriggerAst;
  if (!skipErrors && errors.length) {
    let LINE_START = '\n - ';
    throw new Error(
        `Animation parsing for the ${name} trigger have failed:${LINE_START}${errors.join(LINE_START)}`);
  }
  return buildTrigger(name, triggerAst);
}
