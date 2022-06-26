import * as vscode from 'vscode';

import * as spin from '../spin';
import { isOk } from '../errorable';
import * as output from '../output';
import { longRunningProcess } from '../longrunning';

const BONUS_ENV: { [key: string]: string } = {};

export async function deploy() {
    if (!await ensureEnv("BINDLE_URL", { prompt: "Enter Bindle server URL", placeHolder: "http://bindle.local.fermyon.link/v1" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_URL", { prompt: "Enter Hippo server URL", placeHolder: "http://hippo.local.fermyon.link" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_USERNAME", { prompt: "Enter Hippo user name", placeHolder: "myname" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_PASSWORD", { prompt: "Enter Hippo password", placeHolder: "my$s3cr3t!", password: true })) {
        return;
    }

    const deployResult = await longRunningProcess("Spin deploy in progress...", (tok) =>
        spin.deploy(tok, BONUS_ENV)
    );

    if (isOk(deployResult)) {
        // should we understand it too?
        output.appendLine(deployResult.value);
        output.show();
        await vscode.window.showInformationMessage("Spin deployment complete. See Output pane for application URL.");
    } else {
        output.appendLine(deployResult.message);
        const alreadyExists = deployResult.message.includes('already exists on the server');
        if (alreadyExists) {
            const reactivateResult = await longRunningProcess("Deployment exists, reactivating...", (tok) => 
                spin.deploy(tok, BONUS_ENV, true)
            );
            if (isOk(reactivateResult)) {
                output.appendLine(reactivateResult.value);
                output.show();
                await vscode.window.showInformationMessage("Spin deployment (reactivation) complete. See Output pane for application URL.");
            } else {
                output.appendLine(reactivateResult.message);
                output.show();
                await vscode.window.showErrorMessage("Spin deployment (reactivation) failed. See Output pane for details.");
            }
        } else {
            output.show();
            await vscode.window.showErrorMessage("Spin deployment failed. See Output pane for details.");
        }
    }
}

async function ensureEnv(env: string, promptOpts: vscode.InputBoxOptions): Promise<boolean> {
    if (process.env[env]) {
        return true;
    }

    promptOpts.value = BONUS_ENV[env];
    const envValue = await vscode.window.showInputBox(promptOpts);
    if (!envValue) {
        return false;
    }
    BONUS_ENV[env] = envValue;
    return true;
}
