let {resolve} = require('canonical-path');
let semver = require('semver');
let Package = require('dgeni').Package;
let basePackage = require('../angular-base-package');
let contentPackage = require('../content-package');
let {CONTENTS_PATH, TEMPLATES_PATH, requireFolder} = require('../config');
let CLI_SOURCE_ROOT = resolve(CONTENTS_PATH, 'cli-src');
let CLI_SOURCE_PATH = resolve(CLI_SOURCE_ROOT, 'node_modules/@angular/cli');
let CLI_SOURCE_HELP_PATH = resolve(CLI_SOURCE_PATH, 'help');

// Define the dgeni package for generating the docs
module.exports =
    new Package('cli-docs', [basePackage, contentPackage])

        // Register the services and file readers
        .factory(require('./readers/cli-command'))

        // Register the processors
        .processor(require('./processors/processCliContainerDoc'))
        .processor(require('./processors/processCliCommands'))
        .processor(require('./processors/filterHiddenCommands'))

        // Configure file reading
        .config(function(readFilesProcessor, cliCommandFileReader) {
          readFilesProcessor.fileReaders.push(cliCommandFileReader);
          readFilesProcessor.sourceFiles = readFilesProcessor.sourceFiles.concat([
            {
              basePath: CLI_SOURCE_HELP_PATH,
              include: resolve(CLI_SOURCE_HELP_PATH, '*.json'),
              fileReader: 'cliCommandFileReader'
            },
            {
              basePath: CONTENTS_PATH,
              include: resolve(CONTENTS_PATH, 'cli/**'),
              fileReader: 'contentFileReader'
            },
          ]);
        })

        .config(function(templateFinder, templateEngine, getInjectables) {
          // Where to find the templates for the CLI doc rendering
          templateFinder.templateFolders.unshift(resolve(TEMPLATES_PATH, 'cli'));
          // Add in templating filters and tags
          templateEngine.filters = templateEngine.filters.concat(
              getInjectables(requireFolder(__dirname, './rendering')));
        })


        .config(function(renderDocsProcessor) {

          let cliPackage = require(resolve(CLI_SOURCE_PATH, 'package.json'));
          let repoUrlParts = cliPackage.repository.url.replace(/\.git$/, '').split('/');
          let version = `v${semver.clean(cliPackage.version)}`;
          let repo = repoUrlParts.pop();
          let owner = repoUrlParts.pop();
          let cliVersionInfo = {gitRepoInfo: {owner, repo}, currentVersion: {raw: version}};

          // Add the cli version data to the renderer, for use in things like github links
          renderDocsProcessor.extraData.cliVersionInfo = cliVersionInfo;
        })


        .config(function(convertToJsonProcessor, postProcessHtml) {
          convertToJsonProcessor.docTypes =
              convertToJsonProcessor.docTypes.concat(['cli-command', 'cli-overview']);
          postProcessHtml.docTypes =
              postProcessHtml.docTypes.concat(['cli-command', 'cli-overview']);
        });
