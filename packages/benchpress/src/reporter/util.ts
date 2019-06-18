/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {MeasureValues} from '../measure_values';
import {Statistic} from '../statistic';

export function formatNum(n: number) {
  return n.toFixed(2);
}

export function sortedProps(obj: {[key: string]: any}) {
  return Object.keys(obj).sort();
}

export function formatStats(validSamples: MeasureValues[], metricName: string): string {
  let samples = validSamples.map(measureValues => measureValues.values[metricName]);
  let mean = Statistic.calculateMean(samples);
  let cv = Statistic.calculateCoefficientOfVariation(samples, mean);
  let formattedMean = formatNum(mean);
  // Note: Don't use the unicode character for +- as it might cause
  // hickups for consoles...
  return isNaN(cv) ? formattedMean : `${formattedMean}+-${Math.floor(cv)}%`;
}
