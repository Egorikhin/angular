/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as core from '../../core/src/compiler/compiler_facade_interface';
import {R3ResolvedDependencyType} from '../public_api';
import * as compiler from '../src/compiler_facade_interface';

/**
 * This file is compiler level file which asserts that the set of interfaces in `@angular/core` and
 * `@angular/compiler` match. (Build time failure.)
 *
 * If this file fails to compile it means these two files when out of sync:
 *  - packages/compiler/src/compiler_facade_interface.ts             (master)
 *  - packages/core/src/render3/jit/compiler_facade_interface.ts     (copy)
 *
 * Please ensure that the two files are in sync using this command:
 * ```
 * cp packages/compiler/src/compiler_facade_interface.ts \
 *    packages/core/src/render3/jit/compiler_facade_interface.ts
 * ```
 */

let coreExportedCompilerFacade1: core.ExportedCompilerFacade =
    null !as compiler.ExportedCompilerFacade;
let compilerExportedCompilerFacade2: compiler.ExportedCompilerFacade =
    null !as core.ExportedCompilerFacade;

let coreCompilerFacade: core.CompilerFacade = null !as compiler.CompilerFacade;
let compilerCompilerFacade: compiler.CompilerFacade = null !as core.CompilerFacade;

let coreCoreEnvironment: core.CoreEnvironment = null !as compiler.CoreEnvironment;
let compilerCoreEnvironment: compiler.CoreEnvironment = null !as core.CoreEnvironment;

let coreResourceLoader: core.ResourceLoader = null !as compiler.ResourceLoader;
let compilerResourceLoader: compiler.ResourceLoader = null !as core.ResourceLoader;

let coreStringMap: core.StringMap = null !as compiler.StringMap;
let compilerStringMap: compiler.StringMap = null !as core.StringMap;

let coreProvider: core.Provider = null !as compiler.Provider;
let compilerProvider: compiler.Provider = null !as core.Provider;

let coreR3ResolvedDependencyType: core.R3ResolvedDependencyType =
    null !as compiler.R3ResolvedDependencyType;
let compilerR3ResolvedDependencyType: compiler.R3ResolvedDependencyType =
    null !as core.R3ResolvedDependencyType;

let coreR3ResolvedDependencyType2: R3ResolvedDependencyType =
    null !as core.R3ResolvedDependencyType;
let compilerR3ResolvedDependencyType2: R3ResolvedDependencyType =
    null !as core.R3ResolvedDependencyType;

let coreR3ResolvedDependencyType3: core.R3ResolvedDependencyType =
    null !as R3ResolvedDependencyType;
let compilerR3ResolvedDependencyType3: compiler.R3ResolvedDependencyType =
    null !as R3ResolvedDependencyType;

let coreR3DependencyMetadataFacade: core.R3DependencyMetadataFacade =
    null !as compiler.R3DependencyMetadataFacade;
let compilerR3DependencyMetadataFacade: compiler.R3DependencyMetadataFacade =
    null !as core.R3DependencyMetadataFacade;

let coreR3PipeMetadataFacade: core.R3PipeMetadataFacade = null !as compiler.R3PipeMetadataFacade;
let compilerR3PipeMetadataFacade: compiler.R3PipeMetadataFacade =
    null !as core.R3PipeMetadataFacade;

let coreR3InjectableMetadataFacade: core.R3InjectableMetadataFacade =
    null !as compiler.R3InjectableMetadataFacade;
let compilerR3InjectableMetadataFacade: compiler.R3InjectableMetadataFacade =
    null !as core.R3InjectableMetadataFacade;

let coreR3NgModuleMetadataFacade: core.R3NgModuleMetadataFacade =
    null !as compiler.R3NgModuleMetadataFacade;
let compilerR3NgModuleMetadataFacade: compiler.R3NgModuleMetadataFacade =
    null !as core.R3NgModuleMetadataFacade;

let coreR3InjectorMetadataFacade: core.R3InjectorMetadataFacade =
    null !as compiler.R3InjectorMetadataFacade;
let compilerR3InjectorMetadataFacade: compiler.R3InjectorMetadataFacade =
    null !as core.R3InjectorMetadataFacade;

let coreR3DirectiveMetadataFacade: core.R3DirectiveMetadataFacade =
    null !as compiler.R3DirectiveMetadataFacade;
let compilerR3DirectiveMetadataFacade: compiler.R3DirectiveMetadataFacade =
    null !as core.R3DirectiveMetadataFacade;

let coreR3ComponentMetadataFacade: core.R3ComponentMetadataFacade =
    null !as compiler.R3ComponentMetadataFacade;
let compilerR3ComponentMetadataFacade: compiler.R3ComponentMetadataFacade =
    null !as core.R3ComponentMetadataFacade;

let coreViewEncapsulation: core.ViewEncapsulation = null !as compiler.ViewEncapsulation;
let compilerViewEncapsulation: compiler.ViewEncapsulation = null !as core.ViewEncapsulation;

let coreR3QueryMetadataFacade: core.R3QueryMetadataFacade =
    null !as compiler.R3QueryMetadataFacade;
let compilerR3QueryMetadataFacade: compiler.R3QueryMetadataFacade =
    null !as core.R3QueryMetadataFacade;
