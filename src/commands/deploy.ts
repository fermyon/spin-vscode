import * as vscode from 'vscode';

import { isCancelled } from '../utils/cancellable';
import * as spin from '../spin';
import { shell } from '../utils/shell';
import { isErr } from '../errorable';
import { longRunningProcess } from '../longrunning';
import * as output from '../output';
import { promptLogin } from '../fermyon/environment-ui';

export async function deploy() {
    const loginStatusResult = await spin.loginStatus(shell);
    if (isErr(loginStatusResult)) {
        await vscode.window.showErrorMessage('Unable to check login status. Please choose a deployment environment.');
        return;
    }
    const loginStatus = loginStatusResult.value;

    if (loginStatus === undefined) {
        const switched = await promptLogin();
        if (isCancelled(switched)) {
            return;
        }
    }

    let description = "deployment";
    let deployResult = await longRunningProcess(`Deploying to ${loginStatus?.dashboardUrl}`, (tok) =>
        spin.deploy(tok)
    );

    if (isErr(deployResult)) {
        if (deployResult.message.includes('already exists on the server')) {
            description = 'redeployment';
            deployResult = await longRunningProcess(`Redeploying to ${loginStatus?.dashboardUrl}`, (tok) =>
                spin.deploy(tok, true)
            );
        }
    }

    if (isErr(deployResult)) {
        output.appendLine(`Spin ${description} failed.  Details:`);
        output.appendLine(deployResult.message);
        output.appendLine('');
        await vscode.window.showErrorMessage(`Spin ${description} failed. Error: ${deployResult.message}`);
        return;
    }

    output.appendLine(deployResult.value);
    output.show();
    const message = `Spin ${description} complete. See output pane for application URL.`;
    await vscode.window.showInformationMessage(message);
}
