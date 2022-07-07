import * as vscode from 'vscode';

import { activeEnvironment } from "../fermyon/environment";

export async function openDashboard() {
    const environment = activeEnvironment();
    if (!environment) {
        // Shouldn't happen because of UI context but just in case
        await vscode.window.showErrorMessage('Not connected to Fermyon. Choose Spin: Choose Deployment Environment.');
        return;
    }

    try {
        const hippoUrl = vscode.Uri.parse(environment.hippoUrl);
        const opened = await vscode.env.openExternal(hippoUrl);
        if (!opened) {
            await vscode.window.showErrorMessage(`Unable to open ${environment.hippoUrl}.`);
        }
    } catch {
        await vscode.window.showErrorMessage(`Invalid dashboard URL ${environment.hippoUrl}. Please update your settings.`);
    }
}
