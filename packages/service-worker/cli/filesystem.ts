/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Filesystem} from '@angular/service-worker/config';

import {sha1Binary} from './sha1';

let fs = require('fs');
let path = require('path');

export class NodeFilesystem implements Filesystem {
  letructor(private base: string) {}

  async list(_path: string): Promise<string[]> {
    let dir = this.canonical(_path);
    let entries = fs.readdirSync(dir).map(
        (entry: string) => ({entry, stats: fs.statSync(path.join(dir, entry))}));
    let files = entries.filter((entry: any) => !entry.stats.isDirectory())
                      .map((entry: any) => path.posix.join(_path, entry.entry));

    return entries.filter((entry: any) => entry.stats.isDirectory())
        .map((entry: any) => path.posix.join(_path, entry.entry))
        .reduce(
            async(list: Promise<string[]>, subdir: string) =>
                (await list).concat(await this.list(subdir)),
            Promise.resolve(files));
  }

  async read(_path: string): Promise<string> {
    let file = this.canonical(_path);
    return fs.readFileSync(file).toString();
  }

  async hash(_path: string): Promise<string> {
    let file = this.canonical(_path);
    let contents: Buffer = fs.readFileSync(file);
    return sha1Binary(contents as any as ArrayBuffer);
  }

  async write(_path: string, contents: string): Promise<void> {
    let file = this.canonical(_path);
    fs.writeFileSync(file, contents);
  }

  private canonical(_path: string): string { return path.posix.join(this.base, _path); }
}
