"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schematics_1 = require("@angular-devkit/schematics");
const core_1 = require("@angular-devkit/core");
const workspace_1 = require("@nrwl/workspace");
const workspace_2 = require("@nrwl/workspace");
const workspace_3 = require("@nrwl/workspace");
const workspace_4 = require("@nrwl/workspace");
const init_1 = require("../init/init");
function updateNxJson(options) {
    return workspace_1.updateJsonInTree(`/nx.json`, json => {
        return Object.assign({}, json, { projects: Object.assign({}, json.projects, { [options.name]: { tags: options.parsedTags } }) });
    });
}
function getBuildConfig(project, options) {
    return {
        builder: '@nx/serverless:build',
        options: {
            package: core_1.join(core_1.normalize('.serverless'), options.appProjectRoot),
            serverlessConfig: core_1.join(project.appProjectRoot, 'serverless.yml'),
            tsConfig: core_1.join(options.appProjectRoot, 'tsconfig.app.json'),
            provider: 'aws'
        },
        configurations: {
            production: {
                optimization: true,
                fileReplacements: [
                    {
                        replace: core_1.join(project.appProjectRoot, '.env'),
                        with: core_1.join(project.appProjectRoot, '.env.prod')
                    }
                ]
            }
        }
    };
}
function getServeConfig(options) {
    return {
        builder: '@nx/serverless:execute',
        options: {
            // buildTarget: `${options.name}:build`,
            arguments: {
                verbose: true
            }
        }
    };
}
function updateWorkspaceJson(options) {
    return workspace_1.updateWorkspaceInTree(workspaceJson => {
        const project = {
            root: options.appProjectRoot,
            sourceRoot: core_1.join(options.appProjectRoot, 'src'),
            projectType: 'application',
            prefix: options.name,
            schematics: {},
            architect: {}
        };
        project.architect.build = getBuildConfig(project, options);
        project.architect.serve = getServeConfig(options);
        project.architect.lint = workspace_1.generateProjectLint(core_1.normalize(project.root), core_1.join(core_1.normalize(project.root), 'tsconfig.app.json'), options.linter);
        workspaceJson.projects[options.name] = project;
        workspaceJson.defaultProject = workspaceJson.defaultProject || options.name;
        return workspaceJson;
    });
}
function addAppFiles(options) {
    return schematics_1.mergeWith(schematics_1.apply(schematics_1.url(`./files/app`), [
        schematics_1.template({
            tmpl: '',
            name: options.name,
            root: options.appProjectRoot,
            offset: workspace_4.offsetFromRoot(options.appProjectRoot)
        }),
        schematics_1.move(options.appProjectRoot)
    ]));
}
function addServerlessYMLFile(options) {
    return (host) => {
        host.overwrite(core_1.join(options.appProjectRoot, 'serverless.yml'), `service: ${options.name}
frameworkVersion: ">=1.1.0 <2.0.0"
plugins:
  - serverless-plugin-typescript
  - serverless-offline
  - serverless-dotenv-plugin
  - serverless-plugin-optimize
package:
  individually: true
  excludeDevDependencies: true
  custom:
    enable_optimize:
      local: false
provider:
  name: ${options.provider}
  runtime: nodejs10.x
functions:
  hello-world:
    handler: src/handler.helloWorld
    events:
      - http:
        path: hello-world
        method: get
      `);
    };
}
function addProxy(options) {
    return (host, context) => {
        const projectConfig = workspace_3.getProjectConfig(host, options.frontendProject);
        if (projectConfig.architect && projectConfig.architect.serve) {
            const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
            var apiname = `/${options.name}-api`;
            host.create(pathToProxyFile, JSON.stringify({
                apiname: {
                    target: 'http://localhost:3333',
                    secure: false
                }
            }, null, 2));
            workspace_1.updateWorkspaceInTree(json => {
                projectConfig.architect.serve.options.proxyConfig = pathToProxyFile;
                json.projects[options.frontendProject] = projectConfig;
                return json;
            })(host, context);
        }
    };
}
function default_1(schema) {
    return (host, context) => {
        const options = normalizeOptions(schema);
        return schematics_1.chain([
            init_1.default({
                skipFormat: true
            }),
            workspace_1.addLintFiles(options.appProjectRoot, options.linter),
            addAppFiles(options),
            addServerlessYMLFile(options),
            updateWorkspaceJson(options),
            updateNxJson(options),
            options.unitTestRunner === 'jest'
                ? schematics_1.externalSchematic('@nrwl/jest', 'jest-project', {
                    project: options.name,
                    setupFile: 'none',
                    skipSerializers: true
                })
                : schematics_1.noop(),
            options.frontendProject ? addProxy(options) : schematics_1.noop()
        ])(host, context);
    };
}
exports.default = default_1;
function normalizeOptions(options) {
    const appDirectory = options.directory
        ? `${workspace_2.toFileName(options.directory)}/${workspace_2.toFileName(options.name)}`
        : workspace_2.toFileName(options.name);
    const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
    const appProjectRoot = core_1.join(core_1.normalize('apps'), appDirectory);
    const parsedTags = options.tags
        ? options.tags.split(',').map(s => s.trim())
        : [];
    return Object.assign({}, options, { name: workspace_2.toFileName(appProjectName), frontendProject: options.frontendProject
            ? workspace_2.toFileName(options.frontendProject)
            : undefined, appProjectRoot, provider: options.provider, parsedTags });
}
