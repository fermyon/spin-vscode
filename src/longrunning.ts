import * as vscode from 'vscode';
import { err, Errorable, isErr, ok } from './errorable';
import { cantHappen } from './utils/never';
import { RunningProcess } from './utils/shell';

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export async function longRunningProcess(title: string, action: (token: vscode.CancellationToken) => Promise<Errorable<RunningProcess>>): Promise<Errorable<string>> {
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
                    switch (evt.type) {
                        case 'stderr': {
                                const errLine = evt.value.trim();
                                if (errLine.length > 0) {
                                    progress.report({ message: errLine });
                                }
                            }
                            break;
                        case 'done':
                            resolve(ok(evt.stdout));
                            break;
                        default:
                            cantHappen(evt);
                    }
                },
                complete: () => resolve(ok('')),
                error: (e) => resolve(err(e.toString())),
            });
        });
    });
}
