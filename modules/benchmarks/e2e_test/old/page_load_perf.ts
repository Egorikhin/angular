/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {verifyNoBrowserErrors} from 'angular2/src/testing/perf_util';

describe('ng2 largetable benchmark', function() {

  let URL = 'benchmarks/src/page_load/page_load.html';
  let runner = global['benchpressRunner'];

  afterEach(verifyNoBrowserErrors);


  it('should log the load time', function(done) {
    runner
        .sample({
          id: 'loadTime',
          prepare: null,
          microMetrics: null,
          userMetrics:
              {loadTime: 'The time in milliseconds to bootstrap', someletant: 'Some letant'},
          bindings: [
            benchpress.bind(benchpress.SizeValidator.SAMPLE_SIZE).toValue(2),
            benchpress.bind(benchpress.RegressionSlopeValidator.SAMPLE_SIZE).toValue(2),
            benchpress.bind(benchpress.RegressionSlopeValidator.METRIC).toValue('someletant')
          ],
          execute: () => { browser.get(URL); }
        })
        .then(report => {
          expect(report.completeSample.map(val => val.values.someletant)
                     .every(v => v === 1234567890))
              .toBe(true);
          expect(report.completeSample.map(val => val.values.loadTime)
                     .filter(t => typeof t === 'number' && t > 0)
                     .length)
              .toBeGreaterThan(1);
        })
        .then(done);
  });
});
