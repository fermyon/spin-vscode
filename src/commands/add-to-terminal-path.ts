import path = require('path');
import * as vscode from 'vscode';
import { isErr } from '../errorable';
import { ensureSpinInstalled } from '../installer';

export async function addToTerminalPath() {
    const osId = os();
    if (!osId) {
        await vscode.window.showErrorMessage('Unable to establish OS to add path for');
        return;
    }
    const spinPath = await ensureSpinInstalled();
    if (isErr(spinPath)) {
        await vscode.window.showErrorMessage(`Unable to install Spin: ${spinPath.message}`);
        return;
    }
    const spinDirectory = path.dirname(spinPath.value);

    const envSection = vscode.workspace.getConfiguration(`terminal.integrated.env`);
    const envValues = envSection.get<EnvDictionary>(osId) || {};
    const existingPath = envValues["PATH"];

    const newPath = await prependPath(spinDirectory, existingPath);

    if (newPath) {
        envValues["PATH"] = newPath;
        await envSection.update(osId, envValues, vscode.ConfigurationTarget.Global);
        await vscode.window.showInformationMessage('Configuration updated. You may need to start a new integrated terminal to pick up the new path.');
    }
}

async function prependPath(spinDirectory: string, existingPath: string | undefined): Promise<string | undefined> {
    const dirText = escape(spinDirectory);
    if (existingPath) {
        if (existingPath.indexOf(dirText) >= 0) {
            const choice = await vscode.window.showWarningMessage("The terminal path seems to already contain the Spin path.", "Add it again", "Cancel");
            if (choice !== 'Add it again') {
                return undefined;
            }
        }
        return `${dirText}${separator()}${existingPath}`;
    } else {
        return `${dirText}${separator()}${"${env:PATH}"}`;
    }
}

function os(): string | null {
    switch (process.platform) {
        case 'win32': return 'windows';
        case 'darwin': return 'osx';
        case 'linux': return 'linux';
        default: return null;
    }
}

function separator(): string {
    switch (process.platform) {
        case 'win32': return ';';
        default: return ':';
    }
}

function escape(text: string): string {
    return text.replace(/\\/g, '\\\\');
}

type EnvDictionary = { [key: string]: string };
