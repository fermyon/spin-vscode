import * as vscode from 'vscode';

import { addToTerminalPath } from './commands/add-to-terminal-path';

import * as tasks from './tasks';

export function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('spin.addToTerminalPath', () => addToTerminalPath(context)),
        vscode.tasks.registerTaskProvider("spin", tasks.provider()),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
    // nothing to do here
}
