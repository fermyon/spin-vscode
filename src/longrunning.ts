import * as vscode from 'vscode';
import { err, Errorable, isErr, ok } from './errorable';
import { RunningProcess, RunningProcess2 } from './utils/shell';

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export async function longRunningCancellable(title: string, action: (token: vscode.CancellationToken) => Promise<Errorable<RunningProcess>>): Promise<Errorable<string[]>> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
        title: title
    };
    return await vscode.window.withProgress(options, async (progress, token) => {
        const processE = await action(token);
        return new Promise((resolve, _reject) => {
            if (isErr(processE)) {
                resolve(processE);
                return;
            }
            const process = processE.value;
            const output = Array.of<string>();
            process.stdout.subscribe({
                next: (s) => output.push(s),
                complete: () => resolve(ok(output)),
            });
            process.stderr.subscribe({
                next: (e) => {
                    if (e.trim().length > 0) {
                        progress.report({ message: e });
                    }
                },
                complete: () => resolve(ok(output)),
            });
        });
    });
}

export async function longRunningCancellable2(title: string, action: (token: vscode.CancellationToken) => Promise<Errorable<RunningProcess2>>): Promise<Errorable<string>> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
        title: title
    };
    return await vscode.window.withProgress(options, async (progress, token) => {
        const processE = await action(token);
        return new Promise((resolve, _reject) => {
            if (isErr(processE)) {
                resolve(processE);
                return;
            }
            const process = processE.value;
            process.output.subscribe({
                next: (evt) => {
                    if (evt.type === 'stderr') {
                        const errLine = evt.value.trim();
                        if (errLine.length > 0) {
                            progress.report({ message: errLine });
                        }
                    } else {
                        resolve(ok(evt.stdout));
                    }
                },
                complete: () => resolve(ok('')),
                error: (e) => resolve(err(e.toString())),
            });
            // const output = Array.of<string>();
            // process.stdout.subscribe({
            //     next: (s) => output.push(s),
            //     complete: () => resolve(ok(output)),
            // });
            // process.stderr.subscribe({
            //     next: (e) => {
            //         if (e.trim().length > 0) {
            //             progress.report({ message: e });
            //         }
            //     },
            //     complete: () => resolve(ok(output)),
            // });
        });
    });
}
