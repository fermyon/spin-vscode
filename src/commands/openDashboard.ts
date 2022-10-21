import * as vscode from 'vscode';

import { activeDashboard } from "../fermyon/environment";

export async function openDashboard() {
    const dashboardUrlText = await activeDashboard();
    if (!dashboardUrlText) {
        // Shouldn't happen because of UI context but just in case
        await vscode.window.showErrorMessage('Not connected to Fermyon. Choose Spin: Choose Deployment Environment.');
        return;
    }

    try {
        const dashboardUrl = vscode.Uri.parse(dashboardUrlText);
        const opened = await vscode.env.openExternal(dashboardUrl);
        if (!opened) {
            await vscode.window.showErrorMessage(`Unable to open ${dashboardUrlText}.`);
        }
    } catch {
        await vscode.window.showErrorMessage(`Invalid dashboard URL ${dashboardUrlText}. Please update your settings.`);
    }
}
