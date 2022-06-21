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

export function appendLine(value: string) {
    OUTPUT_CHANNEL.appendLine(value);
}

export function show(preserveFocus?: boolean) {
    OUTPUT_CHANNEL.show(preserveFocus);
}
