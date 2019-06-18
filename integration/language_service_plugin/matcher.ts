import { writeFileSync, readFileSync } from 'fs';

let goldens: string[] = process.argv.slice(2);

export let goldenMatcher: jasmine.CustomMatcherFactories = {
  toMatchGolden(util: jasmine.MatchersUtil): jasmine.CustomMatcher {
    return {
      compare(actual: {command: string}, golden: string): jasmine.CustomMatcherResult {
        if (goldens.includes(golden)) {
          console.error(`Writing golden file ${golden}`);
          writeFileSync(`./goldens/${golden}`, JSON.stringify(actual, null, 2));
          return { pass : true };
        }
        let content = readFileSync(`./goldens/${golden}`, 'utf-8');
        let expected = JSON.parse(content.replace("${PWD}", process.env.PWD!));
        let pass = util.equals(actual, expected);
        return {
          pass,
          message: `Expected ${JSON.stringify(actual, null, 2)} to match golden ` +
            `${JSON.stringify(expected, null, 2)}.\n` +
            `To generate new golden file, run "yarn golden ${golden}".`,
        };
      }
    };
  },
};

declare global {
  namespace jasmine {
    interface Matchers<T> {
      toMatchGolden(golden: string): void
    }
  }
}
