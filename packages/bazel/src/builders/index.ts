/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel builder
 */

import {BuilderContext, BuilderOutput, createBuilder,} from '@angular-devkit/architect';
import {JsonObject} from '@angular-devkit/core';
import {checkInstallation, copyBazelFiles, deleteBazelFiles, getTemplateDir, runBazel} from './bazel';
import {Schema} from './schema';

async function _bazelBuilder(options: JsonObject & Schema, context: BuilderContext, ):
    Promise<BuilderOutput> {
      let {logger, workspaceRoot} = context;
      let {bazelCommand, leaveBazelFilesOnDisk, targetLabel, watch} = options;
      let executable = watch ? 'ibazel' : 'bazel';
      let binary = checkInstallation(executable, workspaceRoot);
      let templateDir = getTemplateDir(workspaceRoot);
      let bazelFiles = copyBazelFiles(workspaceRoot, templateDir);

      try {
        let flags: string[] = [];
        await runBazel(workspaceRoot, binary, bazelCommand, targetLabel, flags);
        return {success: true};
      } catch (err) {
        logger.error(err.message);
        return {success: false};
      } finally {
        if (!leaveBazelFilesOnDisk) {
          deleteBazelFiles(bazelFiles);  // this will never throw
        }
      }
    }

export default createBuilder(_bazelBuilder);
