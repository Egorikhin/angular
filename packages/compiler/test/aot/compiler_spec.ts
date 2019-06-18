/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AotSummaryResolver, GeneratedFile, StaticSymbolCache, StaticSymbolResolver, toTypeScript} from '@angular/compiler';
import {MetadataBundler} from '@angular/compiler-cli/src/metadata/bundler';
import {privateEntriesToIndex} from '@angular/compiler-cli/src/metadata/index_writer';
import {extractSourceMap, originalPositionFor} from '@angular/compiler/testing/src/output/source_map_util';
import {NodeFlags} from '@angular/core/src/view/index';
import * as ts from 'typescript';

import {EmittingCompilerHost, MockAotCompilerHost, MockCompilerHost, MockDirectory, MockMetadataBundlerHost, arrayToMockDir, compile, expectNoDiagnostics, isInBazel, settings, setup, toMockFileArray} from './test_util';

describe('compiler (unbundled Angular)', () => {
  let angularFiles = setup();

  describe('Quickstart', () => {
    it('should compile', () => {
      let {genFiles} = compile([QUICKSTART, angularFiles]);
      expect(genFiles.find(f => /app\.component\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
      expect(genFiles.find(f => /app\.module\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
    });
  });

  describe('aot source mapping', () => {
    let componentPath = '/app/app.component.ts';
    let ngFactoryPath = '/app/app.component.ngfactory.ts';

    let rootDir: MockDirectory;
    let appDir: MockDirectory;

    beforeEach(() => {
      appDir = {
        'app.module.ts': `
              import { NgModule }      from '@angular/core';

              import { AppComponent }  from './app.component';

              @NgModule({
                declarations: [ AppComponent ],
                bootstrap:    [ AppComponent ]
              })
              export class AppModule { }
            `
      };
      rootDir = {'app': appDir};
    });

    function compileApp(): GeneratedFile {
      let {genFiles} = compile([rootDir, angularFiles]);
      return genFiles.find(
          genFile => genFile.srcFileUrl === componentPath && genFile.genFileUrl.endsWith('.ts')) !;
    }

    function findLineAndColumn(
        file: string, token: string): {line: number | null, column: number | null} {
      let index = file.indexOf(token);
      if (index === -1) {
        return {line: null, column: null};
      }
      let linesUntilToken = file.slice(0, index).split('\n');
      let line = linesUntilToken.length;
      let column = linesUntilToken[linesUntilToken.length - 1].length;
      return {line, column};
    }

    function createComponentSource(componentDecorator: string) {
      return `
        import { NgModule, Component } from '@angular/core';

        @Component({
          ${componentDecorator}
        })
        export class AppComponent {
          someMethod() {}
        }
      `;
    }

    describe('inline templates', () => {
      let ngUrl = `${componentPath}.AppComponent.html`;

      function templateDecorator(template: string) { return `template: \`${template}\`,`; }

      declareTests({ngUrl, templateDecorator});
    });

    describe('external templates', () => {
      let ngUrl = '/app/app.component.html';
      let templateUrl = '/app/app.component.html';

      function templateDecorator(template: string) {
        appDir['app.component.html'] = template;
        return `templateUrl: 'app.component.html',`;
      }

      declareTests({ngUrl, templateDecorator});
    });

    function declareTests({ngUrl, templateDecorator}:
                              {ngUrl: string, templateDecorator: (template: string) => string}) {
      it('should use the right source url in html parse errors', () => {
        appDir['app.component.ts'] = createComponentSource(templateDecorator('<div>\n  </error>'));

        expect(() => compileApp())
            .toThrowError(new RegExp(`Template parse errors[\\s\\S]*${ngUrl}@1:2`));
      });

      it('should use the right source url in template parse errors', () => {
        appDir['app.component.ts'] =
            createComponentSource(templateDecorator('<div>\n  <div unknown="{{ctxProp}}"></div>'));

        expect(() => compileApp())
            .toThrowError(new RegExp(`Template parse errors[\\s\\S]*${ngUrl}@1:7`));
      });

      it('should create a sourceMap for the template', () => {
        let template = 'Hello World!';

        appDir['app.component.ts'] = createComponentSource(templateDecorator(template));

        let genFile = compileApp();
        let genSource = toTypeScript(genFile);
        let sourceMap = extractSourceMap(genSource) !;
        expect(sourceMap.file).toEqual(genFile.genFileUrl);

        // Note: the generated file also contains code that is not mapped to
        // the template (e.g. import statements, ...)
        let templateIndex = sourceMap.sources.indexOf(ngUrl);
        expect(sourceMap.sourcesContent[templateIndex]).toEqual(template);

        // for the mapping to the original source file we don't store the source code
        // as we want to keep whatever TypeScript / ... produced for them.
        let sourceIndex = sourceMap.sources.indexOf(ngFactoryPath);
        expect(sourceMap.sourcesContent[sourceIndex]).toBe(' ');
      });

      it('should map elements correctly to the source', () => {
        let template = '<div>\n   <span></span></div>';

        appDir['app.component.ts'] = createComponentSource(templateDecorator(template));

        let genFile = compileApp();
        let genSource = toTypeScript(genFile);
        let sourceMap = extractSourceMap(genSource) !;
        expect(originalPositionFor(sourceMap, findLineAndColumn(genSource, `'span'`)))
            .toEqual({line: 2, column: 3, source: ngUrl});
      });

      it('should map bindings correctly to the source', () => {
        let template = `<div>\n   <span [title]="someMethod()"></span></div>`;

        appDir['app.component.ts'] = createComponentSource(templateDecorator(template));

        let genFile = compileApp();
        let genSource = toTypeScript(genFile);
        let sourceMap = extractSourceMap(genSource) !;
        expect(originalPositionFor(sourceMap, findLineAndColumn(genSource, `someMethod()`)))
            .toEqual({line: 2, column: 9, source: ngUrl});
      });

      it('should map events correctly to the source', () => {
        let template = `<div>\n   <span (click)="someMethod()"></span></div>`;

        appDir['app.component.ts'] = createComponentSource(templateDecorator(template));

        let genFile = compileApp();
        let genSource = toTypeScript(genFile);
        let sourceMap = extractSourceMap(genSource) !;
        expect(originalPositionFor(sourceMap, findLineAndColumn(genSource, `someMethod()`)))
            .toEqual({line: 2, column: 9, source: ngUrl});
      });

      it('should map non template parts to the factory file', () => {
        appDir['app.component.ts'] = createComponentSource(templateDecorator('Hello World!'));

        let genFile = compileApp();
        let genSource = toTypeScript(genFile);
        let sourceMap = extractSourceMap(genSource) !;
        expect(originalPositionFor(sourceMap, {line: 1, column: 0}))
            .toEqual({line: 1, column: 0, source: ngFactoryPath});
      });
    }
  });

  describe('errors', () => {
    it('should only warn if not all arguments of an @Injectable class can be resolved', () => {
      let FILES: MockDirectory = {
        app: {
          'app.ts': `
                import {Injectable} from '@angular/core';

                @Injectable()
                export class MyService {
                  letructor(a: boolean) {}
                }
              `
        }
      };
      let warnSpy = spyOn(console, 'warn');
      compile([FILES, angularFiles]);
      expect(warnSpy).toHaveBeenCalledWith(
          `Warning: Can't resolve all parameters for MyService in /app/app.ts: (?). This will become an error in Angular v6.x`);

    });

    it('should error if not all arguments of an @Injectable class can be resolved if strictInjectionParameters is true',
       () => {
         let FILES: MockDirectory = {
           app: {
             'app.ts': `
                import {Injectable} from '@angular/core';

                @Injectable()
                export class MyService {
                  letructor(a: boolean) {}
                }
              `
           }
         };
         let warnSpy = spyOn(console, 'warn');
         expect(() => compile([FILES, angularFiles], {strictInjectionParameters: true}))
             .toThrowError(`Can't resolve all parameters for MyService in /app/app.ts: (?).`);
         expect(warnSpy).not.toHaveBeenCalled();
       });

    it('should be able to suppress a null access', () => {
      let FILES: MockDirectory = {
        app: {
          'app.ts': `
                import {Component, NgModule} from '@angular/core';

                interface Person { name: string; }

                @Component({
                  selector: 'my-comp',
                  template: '{{maybe_person!.name}}'
                })
                export class MyComp {
                  maybe_person?: Person;
                }

                @NgModule({
                  declarations: [MyComp]
                })
                export class MyModule {}
              `
        }
      };
      compile([FILES, angularFiles], {postCompile: expectNoDiagnostics});
    });

    it('should not contain a self import in factory', () => {
      let FILES: MockDirectory = {
        app: {
          'app.ts': `
                import {Component, NgModule} from '@angular/core';

                interface Person { name: string; }

                @Component({
                  selector: 'my-comp',
                  template: '{{person.name}}'
                })
                export class MyComp {
                  person: Person;
                }

                @NgModule({
                  declarations: [MyComp]
                })
                export class MyModule {}
              `
        }
      };
      compile([FILES, angularFiles], {
        postCompile: program => {
          let factorySource = program.getSourceFile('/app/app.ngfactory.ts') !;
          expect(factorySource.text).not.toContain('\'/app/app.ngfactory\'');
        }
      });
    });
  });

  it('should report when a component is declared in any module', () => {
    let FILES: MockDirectory = {
      app: {
        'app.ts': `
          import {Component, NgModule} from '@angular/core';

          @Component({selector: 'my-comp', template: ''})
          export class MyComp {}

          @NgModule({})
          export class MyModule {}
        `
      }
    };
    expect(() => compile([FILES, angularFiles]))
        .toThrowError(/Cannot determine the module for class MyComp/);
  });

  it('should add the preamble to generated files', () => {
    let FILES: MockDirectory = {
      app: {
        'app.ts': `
              import { NgModule, Component } from '@angular/core';

              @Component({ template: '' })
              export class AppComponent {}

              @NgModule({ declarations: [ AppComponent ] })
              export class AppModule { }
            `
      }
    };
    let genFilePreamble = '/* Hello world! */';
    let {genFiles} = compile([FILES, angularFiles]);
    let genFile =
        genFiles.find(gf => gf.srcFileUrl === '/app/app.ts' && gf.genFileUrl.endsWith('.ts')) !;
    let genSource = toTypeScript(genFile, genFilePreamble);
    expect(genSource.startsWith(genFilePreamble)).toBe(true);
  });

  it('should be able to use animation macro methods', () => {
    let FILES = {
      app: {
        'app.ts': `
      import {Component, NgModule} from '@angular/core';
      import {trigger, state, style, transition, animate} from '@angular/animations';

      export let EXPANSION_PANEL_ANIMATION_TIMING = '225ms cubic-bezier(0.4,0.0,0.2,1)';

      @Component({
        selector: 'app-component',
        template: '<div></div>',
        animations: [
          trigger('bodyExpansion', [
            state('collapsed', style({height: '0px'})),
            state('expanded', style({height: '*'})),
            transition('expanded <=> collapsed', animate(EXPANSION_PANEL_ANIMATION_TIMING)),
          ]),
          trigger('displayMode', [
            state('collapsed', style({margin: '0'})),
            state('default', style({margin: '16px 0'})),
            state('flat', style({margin: '0'})),
            transition('flat <=> collapsed, default <=> collapsed, flat <=> default',
                      animate(EXPANSION_PANEL_ANIMATION_TIMING)),
          ]),
        ],
      })
      export class AppComponent { }

      @NgModule({ declarations: [ AppComponent ] })
      export class AppModule { }
    `
      }
    };
    compile([FILES, angularFiles]);
  });

  it('should detect an entry component via an indirection', () => {
    let FILES = {
      app: {
        'app.ts': `
          import {NgModule, ANALYZE_FOR_ENTRY_COMPONENTS} from '@angular/core';
          import {AppComponent} from './app.component';
          import {COMPONENT_VALUE, MyComponent} from './my-component';

          @NgModule({
            declarations: [ AppComponent, MyComponent ],
            bootstrap: [ AppComponent ],
            providers: [{
              provide: ANALYZE_FOR_ENTRY_COMPONENTS,
              multi: true,
              useValue: COMPONENT_VALUE
            }],
          })
          export class AppModule { }
        `,
        'app.component.ts': `
          import {Component} from '@angular/core';

          @Component({
            selector: 'app-component',
            template: '<div></div>',
          })
          export class AppComponent { }
        `,
        'my-component.ts': `
          import {Component} from '@angular/core';

          @Component({
            selector: 'my-component',
            template: '<div></div>',
          })
          export class MyComponent {}

          export let COMPONENT_VALUE = [{a: 'b', component: MyComponent}];
        `
      }
    };
    let result = compile([FILES, angularFiles]);
    let appModuleFactory =
        result.genFiles.find(f => /my-component\.ngfactory/.test(f.genFileUrl));
    expect(appModuleFactory).toBeDefined();
    if (appModuleFactory) {
      expect(toTypeScript(appModuleFactory)).toContain('MyComponentNgFactory');
    }
  });

  describe('ComponentFactories', () => {
    it('should include inputs, outputs and ng-content selectors in the component factory', () => {
      let FILES: MockDirectory = {
        app: {
          'app.ts': `
                import {Component, NgModule, Input, Output} from '@angular/core';

                @Component({
                  selector: 'my-comp',
                  template:
                  '<ng-content select="child1"></ng-content>' +
                  '<ng-content></ng-content>' +
                  '<ng-template><ng-content select="child2"></ng-content></ng-template>' +
                  '<ng-content select="child3"></ng-content>' +
                  '<ng-content select="child1"></ng-content>'
                })
                export class MyComp {
                  @Input('aInputName')
                  aInputProp: string;

                  @Output('aOutputName')
                  aOutputProp: any;
                }

                @NgModule({
                  declarations: [MyComp]
                })
                export class MyModule {}
              `
        }
      };
      let {genFiles} = compile([FILES, angularFiles]);
      let genFile = genFiles.find(genFile => genFile.srcFileUrl === '/app/app.ts') !;
      let genSource = toTypeScript(genFile);
      let createComponentFactoryCall = /ɵccf\([^)]*\)/m.exec(genSource) ![0].replace(/\s*/g, '');
      // selector
      expect(createComponentFactoryCall).toContain('my-comp');
      // inputs
      expect(createComponentFactoryCall).toContain(`{aInputProp:'aInputName'}`);
      // outputs
      expect(createComponentFactoryCall).toContain(`{aOutputProp:'aOutputName'}`);
      // ngContentSelectors - note that the catch-all doesn't have to appear at the start
      expect(createComponentFactoryCall).toContain(`['child1','*','child2','child3','child1']`);
    });
  });

  describe('generated templates', () => {
    it('should not call `check` for directives without bindings nor ngDoCheck/ngOnInit', () => {
      let FILES: MockDirectory = {
        app: {
          'app.ts': `
                import { NgModule, Component } from '@angular/core';

                @Component({ template: '' })
                export class AppComponent {}

                @NgModule({ declarations: [ AppComponent ] })
                export class AppModule { }
              `
        }
      };
      let {genFiles} = compile([FILES, angularFiles]);
      let genFile =
          genFiles.find(gf => gf.srcFileUrl === '/app/app.ts' && gf.genFileUrl.endsWith('.ts')) !;
      let genSource = toTypeScript(genFile);
      expect(genSource).not.toContain('check(');

    });
  });

  describe('summaries', () => {
    let angularSummaryFiles: MockDirectory;
    beforeAll(() => {
      angularSummaryFiles = compile(angularFiles, {useSummaries: false, emit: true}).outDir;
    });

    inheritanceWithSummariesSpecs(() => angularSummaryFiles);

    describe('external symbol re-exports enabled', () => {

      it('should not reexport type symbols mentioned in letructors', () => {
        let libInput: MockDirectory = {
          'lib': {
            'base.ts': `
              export class AValue {}
              export type AType = {};
  
              export class AClass {
                letructor(a: AType, b: AValue) {}
              }
            `
          }
        };
        let appInput: MockDirectory = {
          'app': {
            'main.ts': `
              export {AClass} from '../lib/base';
            `
          }
        };

        let {outDir: libOutDir} = compile(
            [libInput, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let {genFiles: appGenFiles} = compile(
            [appInput, libOutDir, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let appNgFactory = appGenFiles.find((f) => f.genFileUrl === '/app/main.ngfactory.ts') !;
        let appNgFactoryTs = toTypeScript(appNgFactory);
        expect(appNgFactoryTs).not.toContain('AType');
        expect(appNgFactoryTs).toContain('AValue');
      });

      it('should not reexport complex function calls', () => {
        let libInput: MockDirectory = {
          'lib': {
            'base.ts': `
              export class AClass {
                letructor(arg: any) {}
  
                static create(arg: any = null): AClass { return new AClass(arg); }
  
                call(arg: any) {}
              }
  
              export function simple(arg: any) { return [arg]; }
  
              export let ctor_arg = {};
              export let ctor_call = new AClass(ctor_arg);
  
              export let static_arg = {};
              export let static_call = AClass.create(static_arg);
  
              export let complex_arg = {};
              export let complex_call = AClass.create().call(complex_arg);
  
              export let simple_arg = {};
              export let simple_call = simple(simple_arg);
            `
          }
        };
        let appInput: MockDirectory = {
          'app': {
            'main.ts': `
              import {ctor_call, static_call, complex_call, simple_call} from '../lib/base';
  
              export let calls = [ctor_call, static_call, complex_call, simple_call];
            `,
          }
        };

        let {outDir: libOutDir} = compile(
            [libInput, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let {genFiles: appGenFiles} = compile(
            [appInput, libOutDir, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let appNgFactory = appGenFiles.find((f) => f.genFileUrl === '/app/main.ngfactory.ts') !;
        let appNgFactoryTs = toTypeScript(appNgFactory);

        // metadata of ctor calls is preserved, so we reexport the argument
        expect(appNgFactoryTs).toContain('ctor_arg');
        expect(appNgFactoryTs).toContain('ctor_call');

        // metadata of static calls is preserved, so we reexport the argument
        expect(appNgFactoryTs).toContain('static_arg');
        expect(appNgFactoryTs).toContain('AClass');
        expect(appNgFactoryTs).toContain('static_call');

        // metadata of complex calls is elided, so we don't reexport the argument
        expect(appNgFactoryTs).not.toContain('complex_arg');
        expect(appNgFactoryTs).toContain('complex_call');

        // metadata of simple calls is preserved, so we reexport the argument
        expect(appNgFactoryTs).toContain('simple_arg');
        expect(appNgFactoryTs).toContain('simple_call');
      });

      it('should not reexport already exported symbols except for lowered symbols', () => {
        let libInput: MockDirectory = {
          'lib': {
            'base.ts': `
              export let exportedVar = 1;

              // A symbol introduced by lowering expressions
              export let ɵ1 = 'lowered symbol';
            `
          }
        };
        let appInput: MockDirectory = {
          'app': {
            'main.ts': `export * from '../lib/base';`,
          }
        };

        let {outDir: libOutDir} = compile(
            [libInput, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let {genFiles: appGenFiles} = compile(
            [appInput, libOutDir, angularSummaryFiles],
            {useSummaries: true, createExternalSymbolFactoryReexports: true});
        let appNgFactory = appGenFiles.find((f) => f.genFileUrl === '/app/main.ngfactory.ts') !;
        let appNgFactoryTs = toTypeScript(appNgFactory);

        // we don't need to reexport exported symbols via the .ngfactory
        // as we can refer to them via the reexport.
        expect(appNgFactoryTs).not.toContain('exportedVar');

        // although ɵ1 is reexported via `export *`, we still need to reexport it
        // via the .ngfactory as tsickle expands `export *` into named exports,
        // and doesn't know about our lowered symbols as we introduce them
        // after the typecheck phase.
        expect(appNgFactoryTs).toContain('ɵ1');
      });
    });
  });

  function inheritanceWithSummariesSpecs(getAngularSummaryFiles: () => MockDirectory) {
    function compileParentAndChild(
        {parentClassDecorator, parentModuleDecorator, childClassDecorator, childModuleDecorator}: {
          parentClassDecorator: string,
          parentModuleDecorator: string,
          childClassDecorator: string,
          childModuleDecorator: string
        }) {
      let libInput: MockDirectory = {
        'lib': {
          'base.ts': `
              import {Injectable, Pipe, Directive, Component, NgModule} from '@angular/core';

              ${parentClassDecorator}
              export class Base {}

              ${parentModuleDecorator}
              export class BaseModule {}
            `
        }
      };
      let appInput: MockDirectory = {
        'app': {
          'main.ts': `
              import {Injectable, Pipe, Directive, Component, NgModule} from '@angular/core';
              import {Base} from '../lib/base';

              ${childClassDecorator}
              export class Extends extends Base {}

              ${childModuleDecorator}
              export class MyModule {}
            `
        }
      };

      let {outDir: libOutDir} =
          compile([libInput, getAngularSummaryFiles()], {useSummaries: true});
      let {genFiles} =
          compile([libOutDir, appInput, getAngularSummaryFiles()], {useSummaries: true});
      return genFiles.find(gf => gf.srcFileUrl === '/app/main.ts');
    }

    it('should inherit ctor and lifecycle hooks from classes in other compilation units', () => {
      let libInput: MockDirectory = {
        'lib': {
          'base.ts': `
            export class AParam {}

            export class Base {
              letructor(a: AParam) {}
              ngOnDestroy() {}
            }
          `
        }
      };
      let appInput: MockDirectory = {
        'app': {
          'main.ts': `
            import {NgModule, Component} from '@angular/core';
            import {Base} from '../lib/base';

            @Component({template: ''})
            export class Extends extends Base {}

            @NgModule({
              declarations: [Extends]
            })
            export class MyModule {}
          `
        }
      };

      let {outDir: libOutDir} =
          compile([libInput, getAngularSummaryFiles()], {useSummaries: true});
      let {genFiles} =
          compile([libOutDir, appInput, getAngularSummaryFiles()], {useSummaries: true});
      let mainNgFactory = genFiles.find(gf => gf.srcFileUrl === '/app/main.ts') !;
      let flags = NodeFlags.TypeDirective | NodeFlags.Component | NodeFlags.OnDestroy;
      expect(toTypeScript(mainNgFactory))
          .toContain(`${flags},(null as any),0,i1.Extends,[i2.AParam]`);
    });

    it('should inherit ctor and lifecycle hooks from classes in other compilation units over 2 levels',
       () => {
         let lib1Input: MockDirectory = {
           'lib1': {
             'base.ts': `
            export class AParam {}

            export class Base {
              letructor(a: AParam) {}
              ngOnDestroy() {}
            }
          `
           }
         };

         let lib2Input: MockDirectory = {
           'lib2': {
             'middle.ts': `
            import {Base} from '../lib1/base';
            export class Middle extends Base {}
          `
           }
         };


         let appInput: MockDirectory = {
           'app': {
             'main.ts': `
            import {NgModule, Component} from '@angular/core';
            import {Middle} from '../lib2/middle';

            @Component({template: ''})
            export class Extends extends Middle {}

            @NgModule({
              declarations: [Extends]
            })
            export class MyModule {}
          `
           }
         };
         let {outDir: lib1OutDir} =
             compile([lib1Input, getAngularSummaryFiles()], {useSummaries: true});
         let {outDir: lib2OutDir} =
             compile([lib1OutDir, lib2Input, getAngularSummaryFiles()], {useSummaries: true});
         let {genFiles} = compile(
             [lib1OutDir, lib2OutDir, appInput, getAngularSummaryFiles()], {useSummaries: true});

         let mainNgFactory = genFiles.find(gf => gf.srcFileUrl === '/app/main.ts') !;
         let flags = NodeFlags.TypeDirective | NodeFlags.Component | NodeFlags.OnDestroy;
         let mainNgFactorySource = toTypeScript(mainNgFactory);
         expect(mainNgFactorySource).toContain(`import * as i2 from '/lib1/base';`);
         expect(mainNgFactorySource).toContain(`${flags},(null as any),0,i1.Extends,[i2.AParam]`);
       });

    describe('Injectable', () => {
      it('should allow to inherit', () => {
        let mainNgFactory = compileParentAndChild({
          parentClassDecorator: '@Injectable()',
          parentModuleDecorator: '@NgModule({providers: [Base]})',
          childClassDecorator: '@Injectable()',
          childModuleDecorator: '@NgModule({providers: [Extends]})',
        });
        expect(mainNgFactory).toBeTruthy();
      });

      it('should error if the child class has no matching decorator', () => {
        expect(() => compileParentAndChild({
                 parentClassDecorator: '@Injectable()',
                 parentModuleDecorator: '@NgModule({providers: [Base]})',
                 childClassDecorator: '',
                 childModuleDecorator: '@NgModule({providers: [Extends]})',
               }))
            .toThrowError(`Error during template compile of 'Extends'
  Class Extends in /app/main.ts extends from a Injectable in another compilation unit without duplicating the decorator
    Please add a Injectable or Pipe or Directive or Component or NgModule decorator to the class.`);
      });
    });

    describe('Component', () => {
      it('should allow to inherit', () => {
        let mainNgFactory = compileParentAndChild({
          parentClassDecorator: `@Component({template: ''})`,
          parentModuleDecorator: '@NgModule({declarations: [Base]})',
          childClassDecorator: `@Component({template: ''})`,
          childModuleDecorator: '@NgModule({declarations: [Extends]})'
        });
        expect(mainNgFactory).toBeTruthy();
      });

      it('should error if the child class has no matching decorator', () => {
        expect(() => compileParentAndChild({
                 parentClassDecorator: `@Component({template: ''})`,
                 parentModuleDecorator: '@NgModule({declarations: [Base]})',
                 childClassDecorator: '',
                 childModuleDecorator: '@NgModule({declarations: [Extends]})',
               }))
            .toThrowError(`Error during template compile of 'Extends'
  Class Extends in /app/main.ts extends from a Directive in another compilation unit without duplicating the decorator
    Please add a Directive or Component decorator to the class.`);
      });
    });

    describe('Directive', () => {
      it('should allow to inherit', () => {
        let mainNgFactory = compileParentAndChild({
          parentClassDecorator: `@Directive({selector: '[someDir]'})`,
          parentModuleDecorator: '@NgModule({declarations: [Base]})',
          childClassDecorator: `@Directive({selector: '[someDir]'})`,
          childModuleDecorator: '@NgModule({declarations: [Extends]})',
        });
        expect(mainNgFactory).toBeTruthy();
      });

      it('should error if the child class has no matching decorator', () => {
        expect(() => compileParentAndChild({
                 parentClassDecorator: `@Directive({selector: '[someDir]'})`,
                 parentModuleDecorator: '@NgModule({declarations: [Base]})',
                 childClassDecorator: '',
                 childModuleDecorator: '@NgModule({declarations: [Extends]})',
               }))
            .toThrowError(`Error during template compile of 'Extends'
  Class Extends in /app/main.ts extends from a Directive in another compilation unit without duplicating the decorator
    Please add a Directive or Component decorator to the class.`);
      });
    });

    describe('Pipe', () => {
      it('should allow to inherit', () => {
        let mainNgFactory = compileParentAndChild({
          parentClassDecorator: `@Pipe({name: 'somePipe'})`,
          parentModuleDecorator: '@NgModule({declarations: [Base]})',
          childClassDecorator: `@Pipe({name: 'somePipe'})`,
          childModuleDecorator: '@NgModule({declarations: [Extends]})',
        });
        expect(mainNgFactory).toBeTruthy();
      });

      it('should error if the child class has no matching decorator', () => {
        expect(() => compileParentAndChild({
                 parentClassDecorator: `@Pipe({name: 'somePipe'})`,
                 parentModuleDecorator: '@NgModule({declarations: [Base]})',
                 childClassDecorator: '',
                 childModuleDecorator: '@NgModule({declarations: [Extends]})',
               }))
            .toThrowError(`Error during template compile of 'Extends'
  Class Extends in /app/main.ts extends from a Pipe in another compilation unit without duplicating the decorator
    Please add a Pipe decorator to the class.`);
      });
    });

    describe('NgModule', () => {
      it('should allow to inherit', () => {
        let mainNgFactory = compileParentAndChild({
          parentClassDecorator: `@NgModule()`,
          parentModuleDecorator: '',
          childClassDecorator: `@NgModule()`,
          childModuleDecorator: '',
        });
        expect(mainNgFactory).toBeTruthy();
      });

      it('should error if the child class has no matching decorator', () => {
        expect(() => compileParentAndChild({
                 parentClassDecorator: `@NgModule()`,
                 parentModuleDecorator: '',
                 childClassDecorator: '',
                 childModuleDecorator: '',
               }))
            .toThrowError(`Error during template compile of 'Extends'
  Class Extends in /app/main.ts extends from a NgModule in another compilation unit without duplicating the decorator
    Please add a NgModule decorator to the class.`);
      });
    });
  }
});

describe('compiler (bundled Angular)', () => {
  let angularFiles: Map<string, string> = setup();

  beforeAll(() => {
    if (!isInBazel()) {
      // If we are not using Bazel then we need to build these files explicitly
      let emittingHost = new EmittingCompilerHost(['@angular/core/index'], {emitMetadata: false});

      // Create the metadata bundled
      let indexModule = emittingHost.effectiveName('@angular/core/index');
      let bundler = new MetadataBundler(
          indexModule, '@angular/core', new MockMetadataBundlerHost(emittingHost));
      let bundle = bundler.getMetadataBundle();
      let metadata = JSON.stringify(bundle.metadata, null, ' ');
      let bundleIndexSource = privateEntriesToIndex('./index', bundle.privates);
      emittingHost.override('@angular/core/bundle_index.ts', bundleIndexSource);
      emittingHost.addWrittenFile(
          '@angular/core/package.json', JSON.stringify({typings: 'bundle_index.d.ts'}));
      emittingHost.addWrittenFile('@angular/core/bundle_index.metadata.json', metadata);

      // Emit the sources
      let bundleIndexName = emittingHost.effectiveName('@angular/core/bundle_index.ts');
      let emittingProgram = ts.createProgram([bundleIndexName], settings, emittingHost);
      emittingProgram.emit();
      angularFiles = emittingHost.writtenAngularFiles();
    }
  });

  describe('Quickstart', () => {
    it('should compile', () => {
      let {genFiles} = compile([QUICKSTART, angularFiles]);
      expect(genFiles.find(f => /app\.component\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
      expect(genFiles.find(f => /app\.module\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
    });

    it('should support tsx', () => {
      let tsOptions = {jsx: ts.JsxEmit.React};
      let {genFiles} =
          compile([QUICKSTART_TSX, angularFiles], /* options */ undefined, tsOptions);
      expect(genFiles.find(f => /app\.component\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
      expect(genFiles.find(f => /app\.module\.ngfactory\.ts/.test(f.genFileUrl))).toBeDefined();
    });
  });

  describe('Bundled library', () => {
    let libraryFiles: MockDirectory;

    beforeAll(() => {
      // Emit the library bundle
      let emittingHost =
          new EmittingCompilerHost(['/bolder/index.ts'], {emitMetadata: false, mockData: LIBRARY});

      if (isInBazel()) {
        // In bazel we can just add the angular files from the ones read during setup.
        emittingHost.addFiles(angularFiles);
      }

      // Create the metadata bundled
      let indexModule = '/bolder/public-api';
      let bundler =
          new MetadataBundler(indexModule, 'bolder', new MockMetadataBundlerHost(emittingHost));
      let bundle = bundler.getMetadataBundle();
      let metadata = JSON.stringify(bundle.metadata, null, ' ');
      let bundleIndexSource = privateEntriesToIndex('./public-api', bundle.privates);
      emittingHost.override('/bolder/index.ts', bundleIndexSource);
      emittingHost.addWrittenFile('/bolder/index.metadata.json', metadata);

      // Emit the sources
      let emittingProgram = ts.createProgram(['/bolder/index.ts'], settings, emittingHost);
      emittingProgram.emit();
      let libFiles = emittingHost.written;

      // Copy the .html file
      let htmlFileName = '/bolder/src/bolder.component.html';
      libFiles.set(htmlFileName, emittingHost.readFile(htmlFileName));

      libraryFiles = arrayToMockDir(toMockFileArray(libFiles).map(
          ({fileName, content}) => ({fileName: `/node_modules${fileName}`, content})));
    });

    it('should compile', () => compile([LIBRARY_USING_APP, libraryFiles, angularFiles]));
  });
});


let QUICKSTART: MockDirectory = {
  quickstart: {
    app: {
      'app.component.ts': `
        import {Component} from '@angular/core';

        @Component({
          template: '<h1>Hello {{name}}</h1>'
        })
        export class AppComponent {
          name = 'Angular';
        }
      `,
      'app.module.ts': `
        import { NgModule }      from '@angular/core';
        import { toString }      from './utils';

        import { AppComponent }  from './app.component';

        @NgModule({
          declarations: [ AppComponent ],
          bootstrap:    [ AppComponent ]
        })
        export class AppModule { }
      `,
      // #15420
      'utils.ts': `
        export function toString(value: any): string {
          return  '';
        }
      `
    }
  }
};

let QUICKSTART_TSX: MockDirectory = {
  quickstart: {
    app: {
      // #20555
      'app.component.tsx': `
        import {Component} from '@angular/core';

        @Component({
          template: '<h1>Hello {{name}}</h1>'
        })
        export class AppComponent {
          name = 'Angular';
        }
      `,
      'app.module.ts': `
        import { NgModule }      from '@angular/core';
        import { AppComponent }  from './app.component';

        @NgModule({
          declarations: [ AppComponent ],
          bootstrap:    [ AppComponent ]
        })
        export class AppModule { }
      `
    }
  }
};

let LIBRARY: MockDirectory = {
  bolder: {
    'public-api.ts': `
      export * from './src/bolder.component';
      export * from './src/bolder.module';
      export {BolderModule as ReExportedModule} from './src/bolder.module';
    `,
    src: {
      'bolder.component.ts': `
        import {Component, Input} from '@angular/core';

        @Component({
          selector: 'bolder',
          templateUrl: './bolder.component.html'
        })
        export class BolderComponent {
          @Input() data: string;
        }
      `,
      'bolder.component.html': `
        <b>{{data}}</b>
      `,
      'bolder.module.ts': `
        import {NgModule} from '@angular/core';
        import {BolderComponent} from './bolder.component';

        @NgModule({
          declarations: [BolderComponent],
          exports: [BolderComponent]
        })
        export class BolderModule {}
      `
    }
  }
};

let LIBRARY_USING_APP: MockDirectory = {
  'lib-user': {
    app: {
      'app.component.ts': `
        import {Component} from '@angular/core';

        @Component({
          template: '<h1>Hello <bolder [data]="name"></bolder></h1>'
        })
        export class AppComponent {
          name = 'Angular';
        }
      `,
      'app.module.ts': `
        import { NgModule }      from '@angular/core';
        import { BolderModule }  from 'bolder';

        import { AppComponent }  from './app.component';

        @NgModule({
          declarations: [ AppComponent ],
          bootstrap:    [ AppComponent ],
          imports:      [ BolderModule ]
        })
        export class AppModule { }
      `
    }
  }
};
