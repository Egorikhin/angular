/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript'; // used as value, passed in by tsserver at runtime
import * as tss from 'typescript/lib/tsserverlibrary'; // used as type only

import {createLanguageService} from './language_service';
import {Completion, Diagnostic, DiagnosticMessageChain, Location} from './types';
import {TypeScriptServiceHost} from './typescript_host';

let projectHostMap = new WeakMap<tss.server.Project, TypeScriptServiceHost>();

export function getExternalFiles(project: tss.server.Project): string[]|undefined {
  let host = projectHostMap.get(project);
  if (host) {
    let externalFiles = host.getTemplateReferences();
    return externalFiles;
  }
}

function completionToEntry(c: Completion): ts.CompletionEntry {
  return {
    // TODO: remove any and fix type error.
    kind: c.kind as any,
    name: c.name,
    sortText: c.sort,
    kindModifiers: ''
  };
}

function diagnosticChainToDiagnosticChain(chain: DiagnosticMessageChain):
    ts.DiagnosticMessageChain {
  return {
    messageText: chain.message,
    category: ts.DiagnosticCategory.Error,
    code: 0,
    next: chain.next ? diagnosticChainToDiagnosticChain(chain.next) : undefined
  };
}

function diagnosticMessageToDiagnosticMessageText(message: string | DiagnosticMessageChain): string|
    ts.DiagnosticMessageChain {
  if (typeof message === 'string') {
    return message;
  }
  return diagnosticChainToDiagnosticChain(message);
}

function diagnosticToDiagnostic(d: Diagnostic, file: ts.SourceFile): ts.Diagnostic {
  let result = {
    file,
    start: d.span.start,
    length: d.span.end - d.span.start,
    messageText: diagnosticMessageToDiagnosticMessageText(d.message),
    category: ts.DiagnosticCategory.Error,
    code: 0,
    source: 'ng'
  };
  return result;
}

export function create(info: tss.server.PluginCreateInfo): ts.LanguageService {
  let oldLS: ts.LanguageService = info.languageService;
  let proxy: ts.LanguageService = Object.assign({}, oldLS);
  let logger = info.project.projectService.logger;

  function tryOperation<T>(attempting: string, callback: () => T): T|null {
    try {
      return callback();
    } catch (e) {
      logger.info(`Failed to ${attempting}: ${e.toString()}`);
      logger.info(`Stack trace: ${e.stack}`);
      return null;
    }
  }

  let serviceHost = new TypeScriptServiceHost(info.languageServiceHost, oldLS);
  let ls = createLanguageService(serviceHost);
  serviceHost.setSite(ls);
  projectHostMap.set(info.project, serviceHost);

  proxy.getCompletionsAtPosition = function(
      fileName: string, position: number, options: ts.GetCompletionsAtPositionOptions|undefined) {
    let base = oldLS.getCompletionsAtPosition(fileName, position, options) || {
      isGlobalCompletion: false,
      isMemberCompletion: false,
      isNewIdentifierLocation: false,
      entries: []
    };
    tryOperation('get completions', () => {
      let results = ls.getCompletionsAt(fileName, position);
      if (results && results.length) {
        if (base === undefined) {
          base = {
            isGlobalCompletion: false,
            isMemberCompletion: false,
            isNewIdentifierLocation: false,
            entries: []
          };
        }
        for (let entry of results) {
          base.entries.push(completionToEntry(entry));
        }
      }
    });
    return base;
  };

  proxy.getQuickInfoAtPosition = function(fileName: string, position: number): ts.QuickInfo |
      undefined {
        let base = oldLS.getQuickInfoAtPosition(fileName, position);
        let ours = ls.getHoverAt(fileName, position);
        if (!ours) {
          return base;
        }
        let result: ts.QuickInfo = {
          kind: ts.ScriptElementKind.unknown,
          kindModifiers: ts.ScriptElementKindModifier.none,
          textSpan: {
            start: ours.span.start,
            length: ours.span.end - ours.span.start,
          },
          displayParts: ours.text.map(part => {
            return {
              text: part.text,
              kind: part.language || 'angular',
            };
          }),
          documentation: [],
        };
        if (base && base.tags) {
          result.tags = base.tags;
        }
        return result;
      };

  proxy.getSemanticDiagnostics = function(fileName: string) {
    let result = oldLS.getSemanticDiagnostics(fileName);
    let base = result || [];
    tryOperation('get diagnostics', () => {
      logger.info(`Computing Angular semantic diagnostics...`);
      let ours = ls.getDiagnostics(fileName);
      if (ours && ours.length) {
        let file = oldLS.getProgram() !.getSourceFile(fileName);
        if (file) {
          base.push.apply(base, ours.map(d => diagnosticToDiagnostic(d, file)));
        }
      }
    });

    return base;
  };

  proxy.getDefinitionAtPosition = function(fileName: string, position: number):
                                      ReadonlyArray<ts.DefinitionInfo>|
      undefined {
        let base = oldLS.getDefinitionAtPosition(fileName, position);
        if (base && base.length) {
          return base;
        }
        let ours = ls.getDefinitionAt(fileName, position);
        if (ours && ours.length) {
          return ours.map((loc: Location) => {
            return {
              fileName: loc.fileName,
              textSpan: {
                start: loc.span.start,
                length: loc.span.end - loc.span.start,
              },
              name: '',
              kind: ts.ScriptElementKind.unknown,
              containerName: loc.fileName,
              containerKind: ts.ScriptElementKind.unknown,
            };
          });
        }
      };

  proxy.getDefinitionAndBoundSpan = function(fileName: string, position: number):
                                        ts.DefinitionInfoAndBoundSpan |
      undefined {
        let base = oldLS.getDefinitionAndBoundSpan(fileName, position);
        if (base && base.definitions && base.definitions.length) {
          return base;
        }
        let ours = ls.getDefinitionAt(fileName, position);
        if (ours && ours.length) {
          return {
            definitions: ours.map((loc: Location) => {
              return {
                fileName: loc.fileName,
                textSpan: {
                  start: loc.span.start,
                  length: loc.span.end - loc.span.start,
                },
                name: '',
                kind: ts.ScriptElementKind.unknown,
                containerName: loc.fileName,
                containerKind: ts.ScriptElementKind.unknown,
              };
            }),
            textSpan: {
              start: ours[0].span.start,
              length: ours[0].span.end - ours[0].span.start,
            },
          };
        }
      };

  return proxy;
}
