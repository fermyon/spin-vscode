import * as vscode from 'vscode';
import { isOk } from './errorable';

import * as installer from './installer';
import { warnInstallNotEnsured } from './logger';
import { cantHappen } from './utils/never';

const TASK_SOURCE = "spin";

export function provider(): vscode.TaskProvider<vscode.Task> {
    return new SpinTaskProvider();
}

class SpinTaskProvider implements vscode.TaskProvider<vscode.Task> {
    provideTasks(_token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
        return provideTasks();
    }

    resolveTask(task: vscode.Task, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
        return resolveTask(task);
    }
}

type SpinTaskCommand = 'build' | 'up' | 'deploy';

function provideTasks(): vscode.Task[] {
    const taskSpecs: ReadonlyArray<SpinTaskSpecification> = [
        { name: "build", defn: { type: "spin", command: "build", options: [] }, group: vscode.TaskGroup.Build },
        { name: "up", defn: { type: "spin", command: "up", options: [] }, group: vscode.TaskGroup.Test },
        { name: "deploy", defn: { type: "spin", command: "deploy", options: [] }, group: vscode.TaskGroup.Test },
    ];

    const tasks = taskSpecs.map(({name, defn, group}) => {
        // The idea here is that we shouldn't need the Spin path at provide time
        // because we figure it out at resolve time.  The docs imply we can pass
        // undefined for the execution but then it doesn't get shown in the UI.
        // (It's desirable not to need the path at provide time, because it could
        // be long-running to retrieve it.)

        // const exec = await resolveExec(defn.command, defn.options);
        const exec = new vscode.ProcessExecution("PLACEHOLDER");  // TODO: THIS CANNOT BE RIGHT
        const task = new vscode.Task(defn, vscode.TaskScope.Workspace, name, TASK_SOURCE, exec);
        task.group = group;
        return task;
    });
    return tasks;
}

async function resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const definition = task.definition;
    if (isSpin(definition)) {
        const exec = await resolveExec(definition.command, definition.options || []);
        if (exec) {
            return new vscode.Task(
                definition,
                task.scope ?? vscode.TaskScope.Workspace,
                task.name,
                TASK_SOURCE,
                exec
            );
        }
    }
    return undefined;
}

async function resolveExec(command: SpinTaskCommand, options: ReadonlyArray<string>): Promise<vscode.ShellExecution | vscode.ProcessExecution | undefined> {
    switch (command) {
        case 'build':
        case 'up':
            return await spinCommand([command, ...options]);
        case 'deploy':
            return new vscode.ProcessExecution('${command:spin.deploy}');
        default:
            return cantHappen(command);
    }
}

async function spinCommand(args: string[]): Promise<vscode.ShellExecution> {
    const spinPath = await installer.ensureSpinInstalled();
    if (isOk(spinPath)) {
        return new vscode.ShellExecution(spinPath.value, args, undefined);
    } else {
        warnInstallNotEnsured(`Couldn't install Spin: ${spinPath.message}`);
        return new vscode.ShellExecution("spin", args, undefined);
    }
}

interface SpinTaskSpecification {
    readonly name: SpinTaskCommand;
    readonly defn: SpinTaskDefinition;
    readonly group?: vscode.TaskGroup;
}

interface SpinTaskDefinition extends vscode.TaskDefinition {
    readonly command: SpinTaskCommand;
    readonly options?: ReadonlyArray<string>;
}

function isSpin(defn: vscode.TaskDefinition): defn is SpinTaskDefinition {
    return defn.type === 'spin' &&
        isSpinTaskCommand((<Any>defn).command) &&
        Array.isArray((<Any>defn).options || []);
}

function isSpinTaskCommand(command: unknown): command is SpinTaskCommand {
    return command === 'build' || command === 'up' || command === 'deploy';
}

type Any = { [key: string]: unknown };
