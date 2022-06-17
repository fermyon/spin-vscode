import path = require('path');
import * as vscode from 'vscode';
import { isErr } from '../errorable';
import { ensureSpinInstalled } from '../installer';

export async function addToTerminalPath(context: vscode.ExtensionContext) {
    const spinPath = await ensureSpinInstalled();
    if (isErr(spinPath)) {
        await vscode.window.showErrorMessage(`Unable to install Spin: ${spinPath.message}`);
        return;
    }
    const spinDirectory = path.dirname(spinPath.value);

    const prepend = `${spinDirectory}${separator()}`;
    context.environmentVariableCollection.prepend("PATH", prepend);

    await vscode.window.showInformationMessage('Path updated. If your terminal shows an alert icon, click to relaunch for new path.');
}

function separator(): string {
    switch (process.platform) {
        case 'win32': return ';';
        default: return ':';
    }
}
