/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {DomElementSchemaRegistry} from '@angular/compiler';
import {SchemaInformation} from '../src/html_info';

describe('html_info', () => {
  let domRegistry = new DomElementSchemaRegistry();

  it('should have the same elements as the dom registry', () => {
    // If this test fails, replace the SCHEMA letant in html_info with the one
    // from dom_element_schema_registry and also verify the code to interpret
    // the schema is the same.
    let domElements = domRegistry.allKnownElementNames();
    let infoElements = SchemaInformation.instance.allKnownElements();
    let uniqueToDom = uniqueElements(infoElements, domElements);
    let uniqueToInfo = uniqueElements(domElements, infoElements);
    expect(uniqueToDom).toEqual([]);
    expect(uniqueToInfo).toEqual([]);
  });

  it('should have at least a sub-set of properties', () => {
    let elements = SchemaInformation.instance.allKnownElements();
    for (let element of elements) {
      for (let prop of SchemaInformation.instance.propertiesOf(element)) {
        expect(domRegistry.hasProperty(element, prop, []));
      }
    }
  });

});

function uniqueElements<T>(a: T[], b: T[]): T[] {
  let s = new Set<T>();
  for (let aItem of a) {
    s.add(aItem);
  }
  let result: T[] = [];
  let reported = new Set<T>();
  for (let bItem of b) {
    if (!s.has(bItem) && !reported.has(bItem)) {
      reported.add(bItem);
      result.push(bItem);
    }
  }
  return result;
}