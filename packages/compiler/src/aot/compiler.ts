/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileDirectiveMetadata, CompileIdentifierMetadata, CompileInjectableMetadata, CompileNgModuleMetadata, CompilePipeMetadata, CompilePipeSummary, CompileProviderMetadata, CompileShallowModuleMetadata, CompileStylesheetMetadata, CompileTypeMetadata, CompileTypeSummary, componentFactoryName, flatten, identifierName, templateSourceUrl} from '../compile_metadata';
import {CompilerConfig} from '../config';
import {letantPool} from '../letant_pool';
import {ViewEncapsulation} from '../core';
import {MessageBundle} from '../i18n/message_bundle';
import {Identifiers, createTokenForExternalReference} from '../identifiers';
import {InjectableCompiler} from '../injectable_compiler';
import {CompileMetadataResolver} from '../metadata_resolver';
import * as html from '../ml_parser/ast';
import {HtmlParser} from '../ml_parser/html_parser';
import {removeWhitespaces} from '../ml_parser/html_whitespaces';
import {DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig} from '../ml_parser/interpolation_config';
import {NgModuleCompiler} from '../ng_module_compiler';
import {OutputEmitter} from '../output/abstract_emitter';
import * as o from '../output/output_ast';
import {ParseError} from '../parse_util';
import {compileNgModuleFromRender2 as compileR3Module} from '../render3/r3_module_compiler';
import {compilePipeFromRender2 as compileR3Pipe} from '../render3/r3_pipe_compiler';
import {htmlAstToRender3Ast} from '../render3/r3_template_transform';
import {compileComponentFromRender2 as compileR3Component, compileDirectiveFromRender2 as compileR3Directive} from '../render3/view/compiler';
import {DomElementSchemaRegistry} from '../schema/dom_element_schema_registry';
import {CompiledStylesheet, StyleCompiler} from '../style_compiler';
import {SummaryResolver} from '../summary_resolver';
import {BindingParser} from '../template_parser/binding_parser';
import {TemplateAst} from '../template_parser/template_ast';
import {TemplateParser} from '../template_parser/template_parser';
import {OutputContext, ValueVisitor, error, syntaxError, visitValue} from '../util';
import {TypeCheckCompiler} from '../view_compiler/type_check_compiler';
import {ViewCompileResult, ViewCompiler} from '../view_compiler/view_compiler';

import {AotCompilerHost} from './compiler_host';
import {AotCompilerOptions} from './compiler_options';
import {GeneratedFile} from './generated_file';
import {LazyRoute, listLazyRoutes, parseLazyRoute} from './lazy_routes';
import {PartialModule} from './partial_module';
import {StaticReflector} from './static_reflector';
import {StaticSymbol} from './static_symbol';
import {StaticSymbolResolver} from './static_symbol_resolver';
import {createForJitStub, serializeSummaries} from './summary_serializer';
import {ngfactoryFilePath, normalizeGenFileSuffix, splitTypescriptSuffix, summaryFileName, summaryForJitFileName} from './util';

let enum StubEmitFlags { Basic = 1 << 0, TypeCheck = 1 << 1, All = TypeCheck | Basic }

export class AotCompiler {
  private _templateAstCache =
      new Map<StaticSymbol, {template: TemplateAst[], pipes: CompilePipeSummary[]}>();
  private _analyzedFiles = new Map<string, NgAnalyzedFile>();
  private _analyzedFilesForInjectables = new Map<string, NgAnalyzedFileWithInjectables>();

  letructor(
      private _config: CompilerConfig, private _options: AotCompilerOptions,
      private _host: AotCompilerHost, readonly reflector: StaticReflector,
      private _metadataResolver: CompileMetadataResolver, private _templateParser: TemplateParser,
      private _styleCompiler: StyleCompiler, private _viewCompiler: ViewCompiler,
      private _typeCheckCompiler: TypeCheckCompiler, private _ngModuleCompiler: NgModuleCompiler,
      private _injectableCompiler: InjectableCompiler, private _outputEmitter: OutputEmitter,
      private _summaryResolver: SummaryResolver<StaticSymbol>,
      private _symbolResolver: StaticSymbolResolver) {}

  clearCache() { this._metadataResolver.clearCache(); }

  analyzeModulesSync(rootFiles: string[]): NgAnalyzedModules {
    let analyzeResult = analyzeAndValidateNgModules(
        rootFiles, this._host, this._symbolResolver, this._metadataResolver);
    analyzeResult.ngModules.forEach(
        ngModule => this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(
            ngModule.type.reference, true));
    return analyzeResult;
  }

  analyzeModulesAsync(rootFiles: string[]): Promise<NgAnalyzedModules> {
    let analyzeResult = analyzeAndValidateNgModules(
        rootFiles, this._host, this._symbolResolver, this._metadataResolver);
    return Promise
        .all(analyzeResult.ngModules.map(
            ngModule => this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(
                ngModule.type.reference, false)))
        .then(() => analyzeResult);
  }

  private _analyzeFile(fileName: string): NgAnalyzedFile {
    let analyzedFile = this._analyzedFiles.get(fileName);
    if (!analyzedFile) {
      analyzedFile =
          analyzeFile(this._host, this._symbolResolver, this._metadataResolver, fileName);
      this._analyzedFiles.set(fileName, analyzedFile);
    }
    return analyzedFile;
  }

  private _analyzeFileForInjectables(fileName: string): NgAnalyzedFileWithInjectables {
    let analyzedFile = this._analyzedFilesForInjectables.get(fileName);
    if (!analyzedFile) {
      analyzedFile = analyzeFileForInjectables(
          this._host, this._symbolResolver, this._metadataResolver, fileName);
      this._analyzedFilesForInjectables.set(fileName, analyzedFile);
    }
    return analyzedFile;
  }

  findGeneratedFileNames(fileName: string): string[] {
    let genFileNames: string[] = [];
    let file = this._analyzeFile(fileName);
    // Make sure we create a .ngfactory if we have a injectable/directive/pipe/NgModule
    // or a reference to a non source file.
    // Note: This is overestimating the required .ngfactory files as the real calculation is harder.
    // Only do this for StubEmitFlags.Basic, as adding a type check block
    // does not change this file (as we generate type check blocks based on NgModules).
    if (this._options.allowEmptyCodegenFiles || file.directives.length || file.pipes.length ||
        file.injectables.length || file.ngModules.length || file.exportsNonSourceFiles) {
      genFileNames.push(ngfactoryFilePath(file.fileName, true));
      if (this._options.enableSummariesForJit) {
        genFileNames.push(summaryForJitFileName(file.fileName, true));
      }
    }
    let fileSuffix = normalizeGenFileSuffix(splitTypescriptSuffix(file.fileName, true)[1]);
    file.directives.forEach((dirSymbol) => {
      let compMeta =
          this._metadataResolver.getNonNormalizedDirectiveMetadata(dirSymbol) !.metadata;
      if (!compMeta.isComponent) {
        return;
      }
      // Note: compMeta is a component and therefore template is non null.
      compMeta.template !.styleUrls.forEach((styleUrl) => {
        let normalizedUrl = this._host.resourceNameToFileName(styleUrl, file.fileName);
        if (!normalizedUrl) {
          throw syntaxError(`Couldn't resolve resource ${styleUrl} relative to ${file.fileName}`);
        }
        let needsShim = (compMeta.template !.encapsulation ||
                           this._config.defaultEncapsulation) === ViewEncapsulation.Emulated;
        genFileNames.push(_stylesModuleUrl(normalizedUrl, needsShim, fileSuffix));
        if (this._options.allowEmptyCodegenFiles) {
          genFileNames.push(_stylesModuleUrl(normalizedUrl, !needsShim, fileSuffix));
        }
      });
    });
    return genFileNames;
  }

  emitBasicStub(genFileName: string, originalFileName?: string): GeneratedFile {
    let outputCtx = this._createOutputContext(genFileName);
    if (genFileName.endsWith('.ngfactory.ts')) {
      if (!originalFileName) {
        throw new Error(
            `Assertion error: require the original file for .ngfactory.ts stubs. File: ${genFileName}`);
      }
      let originalFile = this._analyzeFile(originalFileName);
      this._createNgFactoryStub(outputCtx, originalFile, StubEmitFlags.Basic);
    } else if (genFileName.endsWith('.ngsummary.ts')) {
      if (this._options.enableSummariesForJit) {
        if (!originalFileName) {
          throw new Error(
              `Assertion error: require the original file for .ngsummary.ts stubs. File: ${genFileName}`);
        }
        let originalFile = this._analyzeFile(originalFileName);
        _createEmptyStub(outputCtx);
        originalFile.ngModules.forEach(ngModule => {
          // create exports that user code can reference
          createForJitStub(outputCtx, ngModule.type.reference);
        });
      }
    } else if (genFileName.endsWith('.ngstyle.ts')) {
      _createEmptyStub(outputCtx);
    }
    // Note: for the stubs, we don't need a property srcFileUrl,
    // as later on in emitAllImpls we will create the proper GeneratedFiles with the
    // correct srcFileUrl.
    // This is good as e.g. for .ngstyle.ts files we can't derive
    // the url of components based on the genFileUrl.
    return this._codegenSourceModule('unknown', outputCtx);
  }

  emitTypeCheckStub(genFileName: string, originalFileName: string): GeneratedFile|null {
    let originalFile = this._analyzeFile(originalFileName);
    let outputCtx = this._createOutputContext(genFileName);
    if (genFileName.endsWith('.ngfactory.ts')) {
      this._createNgFactoryStub(outputCtx, originalFile, StubEmitFlags.TypeCheck);
    }
    return outputCtx.statements.length > 0 ?
        this._codegenSourceModule(originalFile.fileName, outputCtx) :
        null;
  }

  loadFilesAsync(fileNames: string[], tsFiles: string[]): Promise<
      {analyzedModules: NgAnalyzedModules, analyzedInjectables: NgAnalyzedFileWithInjectables[]}> {
    let files = fileNames.map(fileName => this._analyzeFile(fileName));
    let loadingPromises: Promise<NgAnalyzedModules>[] = [];
    files.forEach(
        file => file.ngModules.forEach(
            ngModule =>
                loadingPromises.push(this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(
                    ngModule.type.reference, false))));
    let analyzedInjectables = tsFiles.map(tsFile => this._analyzeFileForInjectables(tsFile));
    return Promise.all(loadingPromises).then(_ => ({
                                               analyzedModules: mergeAndValidateNgFiles(files),
                                               analyzedInjectables: analyzedInjectables,
                                             }));
  }

  loadFilesSync(fileNames: string[], tsFiles: string[]):
      {analyzedModules: NgAnalyzedModules, analyzedInjectables: NgAnalyzedFileWithInjectables[]} {
    let files = fileNames.map(fileName => this._analyzeFile(fileName));
    files.forEach(
        file => file.ngModules.forEach(
            ngModule => this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(
                ngModule.type.reference, true)));
    let analyzedInjectables = tsFiles.map(tsFile => this._analyzeFileForInjectables(tsFile));
    return {
      analyzedModules: mergeAndValidateNgFiles(files),
      analyzedInjectables: analyzedInjectables,
    };
  }

  private _createNgFactoryStub(
      outputCtx: OutputContext, file: NgAnalyzedFile, emitFlags: StubEmitFlags) {
    let componentId = 0;
    file.ngModules.forEach((ngModuleMeta, ngModuleIndex) => {
      // Note: the code below needs to executed for StubEmitFlags.Basic and StubEmitFlags.TypeCheck,
      // so we don't change the .ngfactory file too much when adding the type-check block.

      // create exports that user code can reference
      this._ngModuleCompiler.createStub(outputCtx, ngModuleMeta.type.reference);

      // add references to the symbols from the metadata.
      // These can be used by the type check block for components,
      // and they also cause TypeScript to include these files into the program too,
      // which will make them part of the analyzedFiles.
      let externalReferences: StaticSymbol[] = [
        // Add references that are available from all the modules and imports.
        ...ngModuleMeta.transitiveModule.directives.map(d => d.reference),
        ...ngModuleMeta.transitiveModule.pipes.map(d => d.reference),
        ...ngModuleMeta.importedModules.map(m => m.type.reference),
        ...ngModuleMeta.exportedModules.map(m => m.type.reference),

        // Add references that might be inserted by the template compiler.
        ...this._externalIdentifierReferences([Identifiers.TemplateRef, Identifiers.ElementRef]),
      ];

      let externalReferenceVars = new Map<any, string>();
      externalReferences.forEach((ref, typeIndex) => {
        externalReferenceVars.set(ref, `_decl${ngModuleIndex}_${typeIndex}`);
      });
      externalReferenceVars.forEach((varName, reference) => {
        outputCtx.statements.push(
            o.variable(varName)
                .set(o.NULL_EXPR.cast(o.DYNAMIC_TYPE))
                .toDeclStmt(o.expressionType(outputCtx.importExpr(
                    reference, /* typeParams */ null, /* useSummaries */ false))));
      });

      if (emitFlags & StubEmitFlags.TypeCheck) {
        // add the type-check block for all components of the NgModule
        ngModuleMeta.declaredDirectives.forEach((dirId) => {
          let compMeta = this._metadataResolver.getDirectiveMetadata(dirId.reference);
          if (!compMeta.isComponent) {
            return;
          }
          componentId++;
          this._createTypeCheckBlock(
              outputCtx, `${compMeta.type.reference.name}_Host_${componentId}`, ngModuleMeta,
              this._metadataResolver.getHostComponentMetadata(compMeta), [compMeta.type],
              externalReferenceVars);
          this._createTypeCheckBlock(
              outputCtx, `${compMeta.type.reference.name}_${componentId}`, ngModuleMeta, compMeta,
              ngModuleMeta.transitiveModule.directives, externalReferenceVars);
        });
      }
    });

    if (outputCtx.statements.length === 0) {
      _createEmptyStub(outputCtx);
    }
  }

  private _externalIdentifierReferences(references: o.ExternalReference[]): StaticSymbol[] {
    let result: StaticSymbol[] = [];
    for (let reference of references) {
      let token = createTokenForExternalReference(this.reflector, reference);
      if (token.identifier) {
        result.push(token.identifier.reference);
      }
    }
    return result;
  }

  private _createTypeCheckBlock(
      ctx: OutputContext, componentId: string, moduleMeta: CompileNgModuleMetadata,
      compMeta: CompileDirectiveMetadata, directives: CompileIdentifierMetadata[],
      externalReferenceVars: Map<any, string>) {
    let {template: parsedTemplate, pipes: usedPipes} =
        this._parseTemplate(compMeta, moduleMeta, directives);
    ctx.statements.push(...this._typeCheckCompiler.compileComponent(
        componentId, compMeta, parsedTemplate, usedPipes, externalReferenceVars, ctx));
  }

  emitMessageBundle(analyzeResult: NgAnalyzedModules, locale: string|null): MessageBundle {
    let errors: ParseError[] = [];
    let htmlParser = new HtmlParser();

    // TODO(vicb): implicit tags & attributes
    let messageBundle = new MessageBundle(htmlParser, [], {}, locale);

    analyzeResult.files.forEach(file => {
      let compMetas: CompileDirectiveMetadata[] = [];
      file.directives.forEach(directiveType => {
        let dirMeta = this._metadataResolver.getDirectiveMetadata(directiveType);
        if (dirMeta && dirMeta.isComponent) {
          compMetas.push(dirMeta);
        }
      });
      compMetas.forEach(compMeta => {
        let html = compMeta.template !.template !;
        // Template URL points to either an HTML or TS file depending on whether
        // the file is used with `templateUrl:` or `template:`, respectively.
        let templateUrl = compMeta.template !.templateUrl !;
        let interpolationConfig =
            InterpolationConfig.fromArray(compMeta.template !.interpolation);
        errors.push(...messageBundle.updateFromTemplate(html, templateUrl, interpolationConfig) !);
      });
    });

    if (errors.length) {
      throw new Error(errors.map(e => e.toString()).join('\n'));
    }

    return messageBundle;
  }

  emitAllPartialModules(
      {ngModuleByPipeOrDirective, files}: NgAnalyzedModules,
      r3Files: NgAnalyzedFileWithInjectables[]): PartialModule[] {
    let contextMap = new Map<string, OutputContext>();

    let getContext = (fileName: string): OutputContext => {
      if (!contextMap.has(fileName)) {
        contextMap.set(fileName, this._createOutputContext(fileName));
      }
      return contextMap.get(fileName) !;
    };

    files.forEach(
        file => this._compilePartialModule(
            file.fileName, ngModuleByPipeOrDirective, file.directives, file.pipes, file.ngModules,
            file.injectables, getContext(file.fileName)));
    r3Files.forEach(
        file => this._compileShallowModules(
            file.fileName, file.shallowModules, getContext(file.fileName)));

    return Array.from(contextMap.values())
        .map(context => ({
               fileName: context.genFilePath,
               statements: [...context.letantPool.statements, ...context.statements],
             }));
  }

  private _compileShallowModules(
      fileName: string, shallowModules: CompileShallowModuleMetadata[],
      context: OutputContext): void {
    shallowModules.forEach(module => compileR3Module(context, module, this._injectableCompiler));
  }

  private _compilePartialModule(
      fileName: string, ngModuleByPipeOrDirective: Map<StaticSymbol, CompileNgModuleMetadata>,
      directives: StaticSymbol[], pipes: StaticSymbol[], ngModules: CompileNgModuleMetadata[],
      injectables: CompileInjectableMetadata[], context: OutputContext): void {
    let errors: ParseError[] = [];

    let schemaRegistry = new DomElementSchemaRegistry();
    let hostBindingParser = new BindingParser(
        this._templateParser.expressionParser, DEFAULT_INTERPOLATION_CONFIG, schemaRegistry, [],
        errors);

    // Process all components and directives
    directives.forEach(directiveType => {
      let directiveMetadata = this._metadataResolver.getDirectiveMetadata(directiveType);
      if (directiveMetadata.isComponent) {
        let module = ngModuleByPipeOrDirective.get(directiveType) !;
        module ||
            error(
                `Cannot determine the module for component '${identifierName(directiveMetadata.type)}'`);

        let htmlAst = directiveMetadata.template !.htmlAst !;
        let preserveWhitespaces = directiveMetadata !.template !.preserveWhitespaces;

        if (!preserveWhitespaces) {
          htmlAst = removeWhitespaces(htmlAst);
        }
        let render3Ast = htmlAstToRender3Ast(htmlAst.rootNodes, hostBindingParser);

        // Map of StaticType by directive selectors
        let directiveTypeBySel = new Map<string, any>();

        let directives = module.transitiveModule.directives.map(
            dir => this._metadataResolver.getDirectiveSummary(dir.reference));

        directives.forEach(directive => {
          if (directive.selector) {
            directiveTypeBySel.set(directive.selector, directive.type.reference);
          }
        });

        // Map of StaticType by pipe names
        let pipeTypeByName = new Map<string, any>();

        let pipes = module.transitiveModule.pipes.map(
            pipe => this._metadataResolver.getPipeSummary(pipe.reference));

        pipes.forEach(pipe => { pipeTypeByName.set(pipe.name, pipe.type.reference); });

        compileR3Component(
            context, directiveMetadata, render3Ast, this.reflector, hostBindingParser,
            directiveTypeBySel, pipeTypeByName);
      } else {
        compileR3Directive(context, directiveMetadata, this.reflector, hostBindingParser);
      }
    });

    pipes.forEach(pipeType => {
      let pipeMetadata = this._metadataResolver.getPipeMetadata(pipeType);
      if (pipeMetadata) {
        compileR3Pipe(context, pipeMetadata, this.reflector);
      }
    });

    injectables.forEach(injectable => this._injectableCompiler.compile(injectable, context));
  }

  emitAllPartialModules2(files: NgAnalyzedFileWithInjectables[]): PartialModule[] {
    // Using reduce like this is a select many pattern (where map is a select pattern)
    return files.reduce<PartialModule[]>((r, file) => {
      r.push(...this._emitPartialModule2(file.fileName, file.injectables));
      return r;
    }, []);
  }

  private _emitPartialModule2(fileName: string, injectables: CompileInjectableMetadata[]):
      PartialModule[] {
    let context = this._createOutputContext(fileName);

    injectables.forEach(injectable => this._injectableCompiler.compile(injectable, context));

    if (context.statements && context.statements.length > 0) {
      return [{fileName, statements: [...context.letantPool.statements, ...context.statements]}];
    }
    return [];
  }

  emitAllImpls(analyzeResult: NgAnalyzedModules): GeneratedFile[] {
    let {ngModuleByPipeOrDirective, files} = analyzeResult;
    let sourceModules = files.map(
        file => this._compileImplFile(
            file.fileName, ngModuleByPipeOrDirective, file.directives, file.pipes, file.ngModules,
            file.injectables));
    return flatten(sourceModules);
  }

  private _compileImplFile(
      srcFileUrl: string, ngModuleByPipeOrDirective: Map<StaticSymbol, CompileNgModuleMetadata>,
      directives: StaticSymbol[], pipes: StaticSymbol[], ngModules: CompileNgModuleMetadata[],
      injectables: CompileInjectableMetadata[]): GeneratedFile[] {
    let fileSuffix = normalizeGenFileSuffix(splitTypescriptSuffix(srcFileUrl, true)[1]);
    let generatedFiles: GeneratedFile[] = [];

    let outputCtx = this._createOutputContext(ngfactoryFilePath(srcFileUrl, true));

    generatedFiles.push(
        ...this._createSummary(srcFileUrl, directives, pipes, ngModules, injectables, outputCtx));

    // compile all ng modules
    ngModules.forEach((ngModuleMeta) => this._compileModule(outputCtx, ngModuleMeta));

    // compile components
    directives.forEach((dirType) => {
      let compMeta = this._metadataResolver.getDirectiveMetadata(<any>dirType);
      if (!compMeta.isComponent) {
        return;
      }
      let ngModule = ngModuleByPipeOrDirective.get(dirType);
      if (!ngModule) {
        throw new Error(
            `Internal Error: cannot determine the module for component ${identifierName(compMeta.type)}!`);
      }

      // compile styles
      let componentStylesheet = this._styleCompiler.compileComponent(outputCtx, compMeta);
      // Note: compMeta is a component and therefore template is non null.
      compMeta.template !.externalStylesheets.forEach((stylesheetMeta) => {
        // Note: fill non shim and shim style files as they might
        // be shared by component with and without ViewEncapsulation.
        let shim = this._styleCompiler.needsStyleShim(compMeta);
        generatedFiles.push(
            this._codegenStyles(srcFileUrl, compMeta, stylesheetMeta, shim, fileSuffix));
        if (this._options.allowEmptyCodegenFiles) {
          generatedFiles.push(
              this._codegenStyles(srcFileUrl, compMeta, stylesheetMeta, !shim, fileSuffix));
        }
      });

      // compile components
      let compViewVars = this._compileComponent(
          outputCtx, compMeta, ngModule, ngModule.transitiveModule.directives, componentStylesheet,
          fileSuffix);
      this._compileComponentFactory(outputCtx, compMeta, ngModule, fileSuffix);
    });
    if (outputCtx.statements.length > 0 || this._options.allowEmptyCodegenFiles) {
      let srcModule = this._codegenSourceModule(srcFileUrl, outputCtx);
      generatedFiles.unshift(srcModule);
    }
    return generatedFiles;
  }

  private _createSummary(
      srcFileName: string, directives: StaticSymbol[], pipes: StaticSymbol[],
      ngModules: CompileNgModuleMetadata[], injectables: CompileInjectableMetadata[],
      ngFactoryCtx: OutputContext): GeneratedFile[] {
    let symbolSummaries = this._symbolResolver.getSymbolsOf(srcFileName)
                                .map(symbol => this._symbolResolver.resolveSymbol(symbol));
    let typeData: {
      summary: CompileTypeSummary,
      metadata: CompileNgModuleMetadata | CompileDirectiveMetadata | CompilePipeMetadata |
          CompileTypeMetadata
    }[] =
        [
          ...ngModules.map(
              meta => ({
                summary: this._metadataResolver.getNgModuleSummary(meta.type.reference) !,
                metadata: this._metadataResolver.getNgModuleMetadata(meta.type.reference) !
              })),
          ...directives.map(ref => ({
                              summary: this._metadataResolver.getDirectiveSummary(ref) !,
                              metadata: this._metadataResolver.getDirectiveMetadata(ref) !
                            })),
          ...pipes.map(ref => ({
                         summary: this._metadataResolver.getPipeSummary(ref) !,
                         metadata: this._metadataResolver.getPipeMetadata(ref) !
                       })),
          ...injectables.map(
              ref => ({
                summary: this._metadataResolver.getInjectableSummary(ref.symbol) !,
                metadata: this._metadataResolver.getInjectableSummary(ref.symbol) !.type
              }))
        ];
    let forJitOutputCtx = this._options.enableSummariesForJit ?
        this._createOutputContext(summaryForJitFileName(srcFileName, true)) :
        null;
    let {json, exportAs} = serializeSummaries(
        srcFileName, forJitOutputCtx, this._summaryResolver, this._symbolResolver, symbolSummaries,
        typeData, this._options.createExternalSymbolFactoryReexports);
    exportAs.forEach((entry) => {
      ngFactoryCtx.statements.push(
          o.variable(entry.exportAs).set(ngFactoryCtx.importExpr(entry.symbol)).toDeclStmt(null, [
            o.StmtModifier.Exported
          ]));
    });
    let summaryJson = new GeneratedFile(srcFileName, summaryFileName(srcFileName), json);
    let result = [summaryJson];
    if (forJitOutputCtx) {
      result.push(this._codegenSourceModule(srcFileName, forJitOutputCtx));
    }
    return result;
  }

  private _compileModule(outputCtx: OutputContext, ngModule: CompileNgModuleMetadata): void {
    let providers: CompileProviderMetadata[] = [];

    if (this._options.locale) {
      let normalizedLocale = this._options.locale.replace(/_/g, '-');
      providers.push({
        token: createTokenForExternalReference(this.reflector, Identifiers.LOCALE_ID),
        useValue: normalizedLocale,
      });
    }

    if (this._options.i18nFormat) {
      providers.push({
        token: createTokenForExternalReference(this.reflector, Identifiers.TRANSLATIONS_FORMAT),
        useValue: this._options.i18nFormat
      });
    }

    this._ngModuleCompiler.compile(outputCtx, ngModule, providers);
  }

  private _compileComponentFactory(
      outputCtx: OutputContext, compMeta: CompileDirectiveMetadata,
      ngModule: CompileNgModuleMetadata, fileSuffix: string): void {
    let hostMeta = this._metadataResolver.getHostComponentMetadata(compMeta);
    let hostViewFactoryVar =
        this._compileComponent(outputCtx, hostMeta, ngModule, [compMeta.type], null, fileSuffix)
            .viewClassVar;
    let compFactoryVar = componentFactoryName(compMeta.type.reference);
    let inputsExprs: o.LiteralMapEntry[] = [];
    for (let propName in compMeta.inputs) {
      let templateName = compMeta.inputs[propName];
      // Don't quote so that the key gets minified...
      inputsExprs.push(new o.LiteralMapEntry(propName, o.literal(templateName), false));
    }
    let outputsExprs: o.LiteralMapEntry[] = [];
    for (let propName in compMeta.outputs) {
      let templateName = compMeta.outputs[propName];
      // Don't quote so that the key gets minified...
      outputsExprs.push(new o.LiteralMapEntry(propName, o.literal(templateName), false));
    }

    outputCtx.statements.push(
        o.variable(compFactoryVar)
            .set(o.importExpr(Identifiers.createComponentFactory).callFn([
              o.literal(compMeta.selector), outputCtx.importExpr(compMeta.type.reference),
              o.variable(hostViewFactoryVar), new o.LiteralMapExpr(inputsExprs),
              new o.LiteralMapExpr(outputsExprs),
              o.literalArr(
                  compMeta.template !.ngContentSelectors.map(selector => o.literal(selector)))
            ]))
            .toDeclStmt(
                o.importType(
                    Identifiers.ComponentFactory,
                    [o.expressionType(outputCtx.importExpr(compMeta.type.reference)) !],
                    [o.TypeModifier.let]),
                [o.StmtModifier.Final, o.StmtModifier.Exported]));
  }

  private _compileComponent(
      outputCtx: OutputContext, compMeta: CompileDirectiveMetadata,
      ngModule: CompileNgModuleMetadata, directiveIdentifiers: CompileIdentifierMetadata[],
      componentStyles: CompiledStylesheet|null, fileSuffix: string): ViewCompileResult {
    let {template: parsedTemplate, pipes: usedPipes} =
        this._parseTemplate(compMeta, ngModule, directiveIdentifiers);
    let stylesExpr = componentStyles ? o.variable(componentStyles.stylesVar) : o.literalArr([]);
    let viewResult = this._viewCompiler.compileComponent(
        outputCtx, compMeta, parsedTemplate, stylesExpr, usedPipes);
    if (componentStyles) {
      _resolveStyleStatements(
          this._symbolResolver, componentStyles, this._styleCompiler.needsStyleShim(compMeta),
          fileSuffix);
    }
    return viewResult;
  }

  private _parseTemplate(
      compMeta: CompileDirectiveMetadata, ngModule: CompileNgModuleMetadata,
      directiveIdentifiers: CompileIdentifierMetadata[]):
      {template: TemplateAst[], pipes: CompilePipeSummary[]} {
    if (this._templateAstCache.has(compMeta.type.reference)) {
      return this._templateAstCache.get(compMeta.type.reference) !;
    }
    let preserveWhitespaces = compMeta !.template !.preserveWhitespaces;
    let directives =
        directiveIdentifiers.map(dir => this._metadataResolver.getDirectiveSummary(dir.reference));
    let pipes = ngModule.transitiveModule.pipes.map(
        pipe => this._metadataResolver.getPipeSummary(pipe.reference));
    let result = this._templateParser.parse(
        compMeta, compMeta.template !.htmlAst !, directives, pipes, ngModule.schemas,
        templateSourceUrl(ngModule.type, compMeta, compMeta.template !), preserveWhitespaces);
    this._templateAstCache.set(compMeta.type.reference, result);
    return result;
  }

  private _createOutputContext(genFilePath: string): OutputContext {
    let importExpr =
        (symbol: StaticSymbol, typeParams: o.Type[] | null = null,
         useSummaries: boolean = true) => {
          if (!(symbol instanceof StaticSymbol)) {
            throw new Error(`Internal error: unknown identifier ${JSON.stringify(symbol)}`);
          }
          let arity = this._symbolResolver.getTypeArity(symbol) || 0;
          let {filePath, name, members} =
              this._symbolResolver.getImportAs(symbol, useSummaries) || symbol;
          let importModule = this._fileNameToModuleName(filePath, genFilePath);

          // It should be good enough to compare filePath to genFilePath and if they are equal
          // there is a self reference. However, ngfactory files generate to .ts but their
          // symbols have .d.ts so a simple compare is insufficient. They should be canonical
          // and is tracked by #17705.
          let selfReference = this._fileNameToModuleName(genFilePath, genFilePath);
          let moduleName = importModule === selfReference ? null : importModule;

          // If we are in a type expression that refers to a generic type then supply
          // the required type parameters. If there were not enough type parameters
          // supplied, supply any as the type. Outside a type expression the reference
          // should not supply type parameters and be treated as a simple value reference
          // to the letructor function itself.
          let suppliedTypeParams = typeParams || [];
          let missingTypeParamsCount = arity - suppliedTypeParams.length;
          let allTypeParams =
              suppliedTypeParams.concat(new Array(missingTypeParamsCount).fill(o.DYNAMIC_TYPE));
          return members.reduce(
              (expr, memberName) => expr.prop(memberName),
              <o.Expression>o.importExpr(
                  new o.ExternalReference(moduleName, name, null), allTypeParams));
        };

    return {statements: [], genFilePath, importExpr, letantPool: new letantPool()};
  }

  private _fileNameToModuleName(importedFilePath: string, containingFilePath: string): string {
    return this._summaryResolver.getKnownModuleName(importedFilePath) ||
        this._symbolResolver.getKnownModuleName(importedFilePath) ||
        this._host.fileNameToModuleName(importedFilePath, containingFilePath);
  }

  private _codegenStyles(
      srcFileUrl: string, compMeta: CompileDirectiveMetadata,
      stylesheetMetadata: CompileStylesheetMetadata, isShimmed: boolean,
      fileSuffix: string): GeneratedFile {
    let outputCtx = this._createOutputContext(
        _stylesModuleUrl(stylesheetMetadata.moduleUrl !, isShimmed, fileSuffix));
    let compiledStylesheet =
        this._styleCompiler.compileStyles(outputCtx, compMeta, stylesheetMetadata, isShimmed);
    _resolveStyleStatements(this._symbolResolver, compiledStylesheet, isShimmed, fileSuffix);
    return this._codegenSourceModule(srcFileUrl, outputCtx);
  }

  private _codegenSourceModule(srcFileUrl: string, ctx: OutputContext): GeneratedFile {
    return new GeneratedFile(srcFileUrl, ctx.genFilePath, ctx.statements);
  }

  listLazyRoutes(entryRoute?: string, analyzedModules?: NgAnalyzedModules): LazyRoute[] {
    let self = this;
    if (entryRoute) {
      let symbol = parseLazyRoute(entryRoute, this.reflector).referencedModule;
      return visitLazyRoute(symbol);
    } else if (analyzedModules) {
      let allLazyRoutes: LazyRoute[] = [];
      for (let ngModule of analyzedModules.ngModules) {
        let lazyRoutes = listLazyRoutes(ngModule, this.reflector);
        for (let lazyRoute of lazyRoutes) {
          allLazyRoutes.push(lazyRoute);
        }
      }
      return allLazyRoutes;
    } else {
      throw new Error(`Either route or analyzedModules has to be specified!`);
    }

    function visitLazyRoute(
        symbol: StaticSymbol, seenRoutes = new Set<StaticSymbol>(),
        allLazyRoutes: LazyRoute[] = []): LazyRoute[] {
      // Support pointing to default exports, but stop recursing there,
      // as the StaticReflector does not yet support default exports.
      if (seenRoutes.has(symbol) || !symbol.name) {
        return allLazyRoutes;
      }
      seenRoutes.add(symbol);
      let lazyRoutes = listLazyRoutes(
          self._metadataResolver.getNgModuleMetadata(symbol, true) !, self.reflector);
      for (let lazyRoute of lazyRoutes) {
        allLazyRoutes.push(lazyRoute);
        visitLazyRoute(lazyRoute.referencedModule, seenRoutes, allLazyRoutes);
      }
      return allLazyRoutes;
    }
  }
}

function _createEmptyStub(outputCtx: OutputContext) {
  // Note: We need to produce at least one import statement so that
  // TypeScript knows that the file is an es6 module. Otherwise our generated
  // exports / imports won't be emitted properly by TypeScript.
  outputCtx.statements.push(o.importExpr(Identifiers.ComponentFactory).toStmt());
}


function _resolveStyleStatements(
    symbolResolver: StaticSymbolResolver, compileResult: CompiledStylesheet, needsShim: boolean,
    fileSuffix: string): void {
  compileResult.dependencies.forEach((dep) => {
    dep.setValue(symbolResolver.getStaticSymbol(
        _stylesModuleUrl(dep.moduleUrl, needsShim, fileSuffix), dep.name));
  });
}

function _stylesModuleUrl(stylesheetUrl: string, shim: boolean, suffix: string): string {
  return `${stylesheetUrl}${shim ? '.shim' : ''}.ngstyle${suffix}`;
}

export interface NgAnalyzedModules {
  ngModules: CompileNgModuleMetadata[];
  ngModuleByPipeOrDirective: Map<StaticSymbol, CompileNgModuleMetadata>;
  files: NgAnalyzedFile[];
  symbolsMissingModule?: StaticSymbol[];
}

export interface NgAnalyzedFileWithInjectables {
  fileName: string;
  injectables: CompileInjectableMetadata[];
  shallowModules: CompileShallowModuleMetadata[];
}

export interface NgAnalyzedFile {
  fileName: string;
  directives: StaticSymbol[];
  pipes: StaticSymbol[];
  ngModules: CompileNgModuleMetadata[];
  injectables: CompileInjectableMetadata[];
  exportsNonSourceFiles: boolean;
}

export interface NgAnalyzeModulesHost { isSourceFile(filePath: string): boolean; }

export function analyzeNgModules(
    fileNames: string[], host: NgAnalyzeModulesHost, staticSymbolResolver: StaticSymbolResolver,
    metadataResolver: CompileMetadataResolver): NgAnalyzedModules {
  let files = _analyzeFilesIncludingNonProgramFiles(
      fileNames, host, staticSymbolResolver, metadataResolver);
  return mergeAnalyzedFiles(files);
}

export function analyzeAndValidateNgModules(
    fileNames: string[], host: NgAnalyzeModulesHost, staticSymbolResolver: StaticSymbolResolver,
    metadataResolver: CompileMetadataResolver): NgAnalyzedModules {
  return validateAnalyzedModules(
      analyzeNgModules(fileNames, host, staticSymbolResolver, metadataResolver));
}

function validateAnalyzedModules(analyzedModules: NgAnalyzedModules): NgAnalyzedModules {
  if (analyzedModules.symbolsMissingModule && analyzedModules.symbolsMissingModule.length) {
    let messages = analyzedModules.symbolsMissingModule.map(
        s =>
            `Cannot determine the module for class ${s.name} in ${s.filePath}! Add ${s.name} to the NgModule to fix it.`);
    throw syntaxError(messages.join('\n'));
  }
  return analyzedModules;
}

// Analyzes all of the program files,
// including files that are not part of the program
// but are referenced by an NgModule.
function _analyzeFilesIncludingNonProgramFiles(
    fileNames: string[], host: NgAnalyzeModulesHost, staticSymbolResolver: StaticSymbolResolver,
    metadataResolver: CompileMetadataResolver): NgAnalyzedFile[] {
  let seenFiles = new Set<string>();
  let files: NgAnalyzedFile[] = [];

  let visitFile = (fileName: string) => {
    if (seenFiles.has(fileName) || !host.isSourceFile(fileName)) {
      return false;
    }
    seenFiles.add(fileName);
    let analyzedFile = analyzeFile(host, staticSymbolResolver, metadataResolver, fileName);
    files.push(analyzedFile);
    analyzedFile.ngModules.forEach(ngModule => {
      ngModule.transitiveModule.modules.forEach(modMeta => visitFile(modMeta.reference.filePath));
    });
  };
  fileNames.forEach((fileName) => visitFile(fileName));
  return files;
}

export function analyzeFile(
    host: NgAnalyzeModulesHost, staticSymbolResolver: StaticSymbolResolver,
    metadataResolver: CompileMetadataResolver, fileName: string): NgAnalyzedFile {
  let directives: StaticSymbol[] = [];
  let pipes: StaticSymbol[] = [];
  let injectables: CompileInjectableMetadata[] = [];
  let ngModules: CompileNgModuleMetadata[] = [];
  let hasDecorators = staticSymbolResolver.hasDecorators(fileName);
  let exportsNonSourceFiles = false;
  // Don't analyze .d.ts files that have no decorators as a shortcut
  // to speed up the analysis. This prevents us from
  // resolving the references in these files.
  // Note: exportsNonSourceFiles is only needed when compiling with summaries,
  // which is not the case when .d.ts files are treated as input files.
  if (!fileName.endsWith('.d.ts') || hasDecorators) {
    staticSymbolResolver.getSymbolsOf(fileName).forEach((symbol) => {
      let resolvedSymbol = staticSymbolResolver.resolveSymbol(symbol);
      let symbolMeta = resolvedSymbol.metadata;
      if (!symbolMeta || symbolMeta.__symbolic === 'error') {
        return;
      }
      let isNgSymbol = false;
      if (symbolMeta.__symbolic === 'class') {
        if (metadataResolver.isDirective(symbol)) {
          isNgSymbol = true;
          directives.push(symbol);
        } else if (metadataResolver.isPipe(symbol)) {
          isNgSymbol = true;
          pipes.push(symbol);
        } else if (metadataResolver.isNgModule(symbol)) {
          let ngModule = metadataResolver.getNgModuleMetadata(symbol, false);
          if (ngModule) {
            isNgSymbol = true;
            ngModules.push(ngModule);
          }
        } else if (metadataResolver.isInjectable(symbol)) {
          isNgSymbol = true;
          let injectable = metadataResolver.getInjectableMetadata(symbol, null, false);
          if (injectable) {
            injectables.push(injectable);
          }
        }
      }
      if (!isNgSymbol) {
        exportsNonSourceFiles =
            exportsNonSourceFiles || isValueExportingNonSourceFile(host, symbolMeta);
      }
    });
  }
  return {
      fileName, directives, pipes, ngModules, injectables, exportsNonSourceFiles,
  };
}

export function analyzeFileForInjectables(
    host: NgAnalyzeModulesHost, staticSymbolResolver: StaticSymbolResolver,
    metadataResolver: CompileMetadataResolver, fileName: string): NgAnalyzedFileWithInjectables {
  let injectables: CompileInjectableMetadata[] = [];
  let shallowModules: CompileShallowModuleMetadata[] = [];
  if (staticSymbolResolver.hasDecorators(fileName)) {
    staticSymbolResolver.getSymbolsOf(fileName).forEach((symbol) => {
      let resolvedSymbol = staticSymbolResolver.resolveSymbol(symbol);
      let symbolMeta = resolvedSymbol.metadata;
      if (!symbolMeta || symbolMeta.__symbolic === 'error') {
        return;
      }
      if (symbolMeta.__symbolic === 'class') {
        if (metadataResolver.isInjectable(symbol)) {
          let injectable = metadataResolver.getInjectableMetadata(symbol, null, false);
          if (injectable) {
            injectables.push(injectable);
          }
        } else if (metadataResolver.isNgModule(symbol)) {
          let module = metadataResolver.getShallowModuleMetadata(symbol);
          if (module) {
            shallowModules.push(module);
          }
        }
      }
    });
  }
  return {fileName, injectables, shallowModules};
}

function isValueExportingNonSourceFile(host: NgAnalyzeModulesHost, metadata: any): boolean {
  let exportsNonSourceFiles = false;

  class Visitor implements ValueVisitor {
    visitArray(arr: any[], context: any): any { arr.forEach(v => visitValue(v, this, context)); }
    visitStringMap(map: {[key: string]: any}, context: any): any {
      Object.keys(map).forEach((key) => visitValue(map[key], this, context));
    }
    visitPrimitive(value: any, context: any): any {}
    visitOther(value: any, context: any): any {
      if (value instanceof StaticSymbol && !host.isSourceFile(value.filePath)) {
        exportsNonSourceFiles = true;
      }
    }
  }

  visitValue(metadata, new Visitor(), null);
  return exportsNonSourceFiles;
}

export function mergeAnalyzedFiles(analyzedFiles: NgAnalyzedFile[]): NgAnalyzedModules {
  let allNgModules: CompileNgModuleMetadata[] = [];
  let ngModuleByPipeOrDirective = new Map<StaticSymbol, CompileNgModuleMetadata>();
  let allPipesAndDirectives = new Set<StaticSymbol>();

  analyzedFiles.forEach(af => {
    af.ngModules.forEach(ngModule => {
      allNgModules.push(ngModule);
      ngModule.declaredDirectives.forEach(
          d => ngModuleByPipeOrDirective.set(d.reference, ngModule));
      ngModule.declaredPipes.forEach(p => ngModuleByPipeOrDirective.set(p.reference, ngModule));
    });
    af.directives.forEach(d => allPipesAndDirectives.add(d));
    af.pipes.forEach(p => allPipesAndDirectives.add(p));
  });

  let symbolsMissingModule: StaticSymbol[] = [];
  allPipesAndDirectives.forEach(ref => {
    if (!ngModuleByPipeOrDirective.has(ref)) {
      symbolsMissingModule.push(ref);
    }
  });
  return {
    ngModules: allNgModules,
    ngModuleByPipeOrDirective,
    symbolsMissingModule,
    files: analyzedFiles
  };
}

function mergeAndValidateNgFiles(files: NgAnalyzedFile[]): NgAnalyzedModules {
  return validateAnalyzedModules(mergeAnalyzedFiles(files));
}
