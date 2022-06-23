import * as vscode from 'vscode';

import { shell } from '../utils/shell';
import * as spin from '../spin';
import { isOk } from '../errorable';
import * as output from '../output';
import { longRunning, longRunningCancellable, longRunningCancellable2 } from '../longrunning';

export async function deploy() {
    // TODO: how to unset them if you make a typo?!?!?!?
    if (!await ensureEnv("BINDLE_URL", { prompt: "Enter Bindle server URL", placeHolder: "http://bindle.local.fermyon.link/v1" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_URL", { prompt: "Enter Hippo server URL", placeHolder: "http://hippo.local.fermyon.link" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_USERNAME", { prompt: "Enter Hippo user name", placeHolder: "myname" })) {
        return;
    }
    if (!await ensureEnv("HIPPO_PASSWORD", { prompt: "Enter Hippo password", placeHolder: "my$s3cr3t!" })) {
        return;
    }

    // const deployResult = await longRunning("Spin deploy in progress...", () =>
    //     spin.deploy(shell)
    // );
    const deployResult = await longRunningCancellable2("Spin deploy in progress...", (tok) =>
        spin.deploy3(tok)
    );

    if (isOk(deployResult)) {
        // output already printed to channel - should we understand it too?
        output.show();
        await vscode.window.showInformationMessage("Spin deployment complete. See Output pane for application URL.");
    } else {
        output.appendLine(deployResult.message);
        const alreadyExists = deployResult.message.includes('already exists on the server');
        if (alreadyExists) {
            const reactivateResult = await await longRunning("Deployment exists, reactivating...", () =>
                spin.deploy(shell, true)
            );
            if (isOk(reactivateResult)) {
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
    if (!process.env[env]) {
        const envValue = await vscode.window.showInputBox(promptOpts);
        if (!envValue) {
            return false;
        }
        process.env[env] = envValue;
    }
    return true;
}
