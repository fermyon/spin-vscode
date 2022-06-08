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
        { name: "build", defn: { type: "spin", command: "build", options: [] }},
        { name: "up", defn: { type: "spin", command: "up", options: [] }},
    ];

    const tasks = taskSpecs.map(async ({name, defn}) => {
        const cmd = await spinCommand([defn.command, ...defn.options ?? []]);
        return new vscode.Task(defn, vscode.TaskScope.Workspace, name, TASK_SOURCE, cmd);
    });
    return await Promise.all(tasks);
}

async function resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const definition = task.definition;
    if (isSpin(definition)) {
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
        warnInstallNotEnsured(`Couldn't : ${spinPath.message}`);
        return new vscode.ShellExecution("spin", args, undefined);
    }
}

interface SpinTaskSpecification {
    readonly name: string;
    readonly defn: SpinTaskDefinition;
}

interface SpinTaskDefinition extends vscode.TaskDefinition {
    readonly command: string;
    readonly options?: ReadonlyArray<string>;
}

function isSpin(task: vscode.TaskDefinition): task is SpinTaskDefinition {
    return task.type === 'spin' && (<Any>task).command !== undefined;
}

type Any = { [key: string]: unknown };
