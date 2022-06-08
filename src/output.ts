import * as vscode from 'vscode';

const OUTPUT_CHANNEL = vscode.window.createOutputChannel("Spin");

let shownInstallErrorToast = false;

export function warnInstallNotEnsured(message: string, always?: 'always' | 'if-not-shown') {
    if (!shownInstallErrorToast || always === 'always') {
        shownInstallErrorToast = true;
        vscode.window.showWarningMessage(message);
    } else {
        OUTPUT_CHANNEL.appendLine(message);
    }
}
