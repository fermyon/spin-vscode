import * as vscode from 'vscode';
import { isOk } from './errorable';

import * as installer from './installer';
import { warnInstallNotEnsured } from './output';

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

async function provideTasks(): Promise<vscode.Task[]> {
    const taskSpecs: ReadonlyArray<SpinTaskSpecification> = [
        { name: "build", cmdType: 'exec', defn: { type: "spin", command: "build", options: [] }, group: vscode.TaskGroup.Build },
        { name: "up", cmdType: 'exec', defn: { type: "spin", command: "up", options: [] }, group: vscode.TaskGroup.Test },
        { name: "deploy", cmdType: 'vsc', defn: { type: "spin", command: "deploy", options: [] }, group: vscode.TaskGroup.Test },
    ];

    const tasks = taskSpecs.map(async ({name, cmdType, defn, group}) => {
        if (cmdType === 'exec') {
            const cmd = await spinCommand([defn.command, ...defn.options ?? []]);
            const task = new vscode.Task(defn, vscode.TaskScope.Workspace, name, TASK_SOURCE, cmd);
            task.group = group;
            return task;
        } else {
            const task = new vscode.Task(defn, vscode.TaskScope.Workspace, name, TASK_SOURCE, new vscode.ProcessExecution('${command:spin.deploy}'));
            task.group = group;
            return task;
        }
    });
    return await Promise.all(tasks);
}

async function resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const definition = task.definition;
    if (isSpin(definition)) {
        if (definition.command === 'deploy') {
            return new vscode.Task(
                definition,
                task.scope ?? vscode.TaskScope.Workspace,
                task.name,
                TASK_SOURCE,
                new vscode.ProcessExecution('${command:spin.deploy}')
            );
        }
        const cmd = await spinCommand([definition.command, ...(definition.options ?? [])]);
        return new vscode.Task(
            definition,
            task.scope ?? vscode.TaskScope.Workspace,
            task.name,
            TASK_SOURCE,
            cmd
        );
    }
    return undefined;
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
    readonly name: string;
    readonly cmdType: 'exec' | 'vsc';
    readonly defn: SpinTaskDefinition;
    readonly group?: vscode.TaskGroup;
}

interface SpinTaskDefinition extends vscode.TaskDefinition {
    readonly command: string;
    readonly options?: ReadonlyArray<string>;
}

function isSpin(task: vscode.TaskDefinition): task is SpinTaskDefinition {
    return task.type === 'spin' && (<Any>task).command !== undefined;
}

type Any = { [key: string]: unknown };
