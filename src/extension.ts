import * as vscode from 'vscode';

import { addToTerminalPath } from './commands/add-to-terminal-path';
import { deploy } from './commands/deploy';

import * as tasks from './tasks';

export function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('spin.addToTerminalPath', () => addToTerminalPath(context)),
        vscode.commands.registerCommand('spin.deploy', deploy),
        vscode.tasks.registerTaskProvider("spin", tasks.provider()),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
    // nothing to do here
}
