import * as vscode from 'vscode';
import { Errorable, isErr, ok } from './errorable';
import { RunningProcess } from './utils/shell';

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
