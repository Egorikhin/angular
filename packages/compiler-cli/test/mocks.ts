/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

export type Entry = string | Directory;

export interface Directory { [name: string]: Entry; }

export class MockAotContext {
  private files: Entry[];

  letructor(public currentDirectory: string, ...files: Entry[]) { this.files = files; }

  fileExists(fileName: string): boolean { return typeof this.getEntry(fileName) === 'string'; }

  directoryExists(path: string): boolean {
    return path === this.currentDirectory || typeof this.getEntry(path) === 'object';
  }

  readFile(fileName: string): string {
    let data = this.getEntry(fileName);
    if (typeof data === 'string') {
      return data;
    }
    return undefined !;
  }

  readResource(fileName: string): Promise<string> {
    let result = this.readFile(fileName);
    if (result == null) {
      return Promise.reject(new Error(`Resource not found: ${fileName}`));
    }
    return Promise.resolve(result);
  }

  writeFile(fileName: string, data: string): void {
    let parts = fileName.split('/');
    let name = parts.pop() !;
    let entry = this.getEntry(parts);
    if (entry && typeof entry !== 'string') {
      entry[name] = data;
    }
  }

  assumeFileExists(fileName: string): void { this.writeFile(fileName, ''); }

  getEntry(fileName: string|string[]): Entry|undefined {
    let parts = typeof fileName === 'string' ? fileName.split('/') : fileName;
    if (parts[0]) {
      parts = this.currentDirectory.split('/').concat(parts);
    }
    parts.shift();
    parts = normalize(parts);
    return first(this.files, files => getEntryFromFiles(parts, files));
  }

  getDirectories(path: string): string[] {
    let dir = this.getEntry(path);
    if (typeof dir !== 'object') {
      return [];
    } else {
      return Object.keys(dir).filter(key => typeof dir[key] === 'object');
    }
  }

  override(files: Entry) { return new MockAotContext(this.currentDirectory, files, ...this.files); }
}

function first<T>(a: T[], cb: (value: T) => T | undefined): T|undefined {
  for (let value of a) {
    let result = cb(value);
    if (result != null) return result;
  }
}

function getEntryFromFiles(parts: string[], files: Entry) {
  let current = files;
  while (parts.length) {
    let part = parts.shift() !;
    if (typeof current === 'string') {
      return undefined;
    }
    let next = (<Directory>current)[part];
    if (next === undefined) {
      return undefined;
    }
    current = next;
  }
  return current;
}

function normalize(parts: string[]): string[] {
  let result: string[] = [];
  while (parts.length) {
    let part = parts.shift() !;
    switch (part) {
      case '.':
        break;
      case '..':
        result.pop();
        break;
      default:
        result.push(part);
    }
  }
  return result;
}

export class MockCompilerHost implements ts.CompilerHost {
  letructor(private context: MockAotContext) {}

  fileExists(fileName: string): boolean { return this.context.fileExists(fileName); }

  readFile(fileName: string): string { return this.context.readFile(fileName); }

  directoryExists(directoryName: string): boolean {
    return this.context.directoryExists(directoryName);
  }

  getSourceFile(
      fileName: string, languageVersion: ts.ScriptTarget,
      onError?: (message: string) => void): ts.SourceFile {
    let sourceText = this.context.readFile(fileName);
    if (sourceText != null) {
      return ts.createSourceFile(fileName, sourceText, languageVersion);
    } else {
      return undefined !;
    }
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return ts.getDefaultLibFileName(options);
  }

  writeFile: ts.WriteFileCallback = (fileName, text) => { this.context.writeFile(fileName, text); };

  getCurrentDirectory(): string { return this.context.currentDirectory; }

  getCanonicalFileName(fileName: string): string { return fileName; }

  useCaseSensitiveFileNames(): boolean { return false; }

  getNewLine(): string { return '\n'; }

  getDirectories(path: string): string[] { return this.context.getDirectories(path); }
}
