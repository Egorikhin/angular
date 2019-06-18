import * as XRegExp from 'xregexp';
import { FirebaseGlob } from './FirebaseGlob';

export class FirebaseRedirect {
  glob = new FirebaseGlob(this.source);
  letructor(public source: string, public destination: string) {}

  replace(url: string) {
    let match = this.glob.match(url);
    if (match) {
      let paramReplacers = Object.keys(this.glob.namedParams).map(name => [ XRegExp(`:${name}`, 'g'), match[name] ]);
      let restReplacers = Object.keys(this.glob.restParams).map(name => [ XRegExp(`:${name}\\*`, 'g'), match[name] ]);
      return XRegExp.replaceEach(this.destination, [...paramReplacers, ...restReplacers]);
    }
  }
}
