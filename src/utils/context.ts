import * as vscode from 'vscode';

export async function setAmbientContext(name: string, value: unknown) {
    await vscode.commands.executeCommand('setContext', name, value);
}
