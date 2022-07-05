import * as vscode from 'vscode';

import { addToTerminalPath } from './commands/add-to-terminal-path';
import { connect } from './commands/connect';
import { deploy } from './commands/deploy';
import { openDashboard } from './commands/openDashboard';
import { showActiveEnvironmentUI } from './fermyon/environment-ui';

import * as tasks from './tasks';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('spin.addToTerminalPath', () => addToTerminalPath(context)),
        vscode.commands.registerCommand('spin.deploy', () => deploy(context)),
        vscode.commands.registerCommand('spin.connect', () => connect(context)),
        vscode.commands.registerCommand('spin.openDashboard', openDashboard),
        vscode.tasks.registerTaskProvider("spin", tasks.provider()),
    ];

    context.subscriptions.push(...disposables);

    await showActiveEnvironmentUI(context);
}

export function deactivate() {
    // nothing to do here
}
