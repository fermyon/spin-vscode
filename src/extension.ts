import * as vscode from 'vscode';

import { addToTerminalPath } from './commands/add-to-terminal-path';
import { connect, connectToActive } from './commands/connect';
import { deploy } from './commands/deploy';
import { openDashboard } from './commands/openDashboard';

import * as tasks from './tasks';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('spin.addToTerminalPath', () => addToTerminalPath(context)),
        vscode.commands.registerCommand('spin.deploy', () => deploy(context)),
        vscode.commands.registerCommand('spin.connect', connect),
        vscode.commands.registerCommand('spin.openDashboard', openDashboard),
        vscode.tasks.registerTaskProvider("spin", tasks.provider()),
    ];

    context.subscriptions.push(...disposables);

    await connectToActive();
}

export function deactivate() {
    // nothing to do here
}
