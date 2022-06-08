import * as vscode from 'vscode';

import * as tasks from './tasks';

export function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.tasks.registerTaskProvider("spin", tasks.provider())
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
    // nothing to do here
}
