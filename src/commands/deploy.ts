import * as vscode from 'vscode';

import * as spin from '../spin';
import { isOk } from '../errorable';
import * as output from '../output';
import { longRunningProcess } from '../longrunning';
import { activeEnvironment, FermyonEnvironment, getHippoPassword, saveEnvironment, saveHippoPassword } from '../fermyon/environment';
import { accepted, Cancellable, cancelled, isCancelled } from '../utils/cancellable';
import { cantHappen } from '../utils/never';
import { connectTo } from './connect';

export async function deploy(context: vscode.ExtensionContext) {
    const fermyonEnv = activeEnvironment();

    const deployParameters_ = await completeDeployParameters(context, fermyonEnv);
    if (isCancelled(deployParameters_)) {
        return;
    }
    const [deployParameters, unsaved] = deployParameters_.value;

    const deployResult = await longRunningProcess("Spin deploy in progress...", (tok) =>
        spin.deploy(tok, deployParameters)
    );

    if (isOk(deployResult)) {
        // should we understand it too?
        output.appendLine(deployResult.value);
        output.show();
        await notifyDeploymentComplete(unsaved, "deployment", context, deployParameters);
    } else {
        output.appendLine(deployResult.message);
        const alreadyExists = deployResult.message.includes('already exists on the server');
        if (alreadyExists) {
            const reactivateResult = await longRunningProcess("Deployment exists, reactivating...", (tok) => 
                spin.deploy(tok, deployParameters, true)
            );
            if (isOk(reactivateResult)) {
                output.appendLine(reactivateResult.value);
                output.show();
                await notifyDeploymentComplete(unsaved, "deployment (reactivation)", context, deployParameters);
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

async function notifyDeploymentComplete(unsaved: UnsavedEnvironmentInfo, description: string, context: vscode.ExtensionContext, deployParameters: spin.DeployParameters) {
    const message = `Spin ${description} complete. See output pane for application URL.`;
    if (unsaved.toSave === 'none') {
        await vscode.window.showInformationMessage(message);
    } else if (unsaved.toSave === 'password') {
        const savePassword = await vscode.window.showInformationMessage(message, "Save Password");
        if (savePassword) {
            await saveHippoPassword(context, unsaved.envName, deployParameters.hippoPassword);
        }
    } else if (unsaved.toSave === 'all') {
        const saveAll = await vscode.window.showInformationMessage(message, "Save Deployment Settings", "Save Without Password");
        if (saveAll) {
            const envName = await vscode.window.showInputBox({ prompt: "Pick a name for these settings" });
            if (!envName) {
                return;
            }
            const environment = {
                name: envName,
                bindleUrl: deployParameters.bindleUrl,
                hippoUrl: deployParameters.hippoUrl,
                hippoUsername: deployParameters.hippoUsername,
            };
            await saveEnvironment(context, environment, deployParameters.hippoPassword);
            connectTo(environment);
        }
    } else {
        cantHappen(unsaved);
    }
}

async function completeDeployParameters(context: vscode.ExtensionContext, fermyonEnv: FermyonEnvironment | undefined): Promise<Cancellable<[spin.DeployParameters, UnsavedEnvironmentInfo]>> {
    if (fermyonEnv) {
        const hippoPassword = await getHippoPassword(context, fermyonEnv.name);
        if (hippoPassword) {
            return accepted([{ hippoPassword, ...fermyonEnv}, { toSave: 'none'} ]);
        } else {
            const hippoPassword = await vscode.window.showInputBox({ prompt: `Hippo password for ${fermyonEnv.name}`, password: true });
            if (hippoPassword) {
                return accepted([{ hippoPassword, ...fermyonEnv}, { toSave: 'password', envName: fermyonEnv.name }]);
            } else {
                return cancelled();
            }
        }
    } else {
        const deployParameters = await promptOrEnvDeploymentParameters();
        if (isCancelled(deployParameters)) {
            return cancelled();
        } else {
            return accepted([deployParameters.value, { toSave: 'all' }]);
        }
    }
}

async function promptOrEnvDeploymentParameters(): Promise<Cancellable<spin.DeployParameters>> {
    const bindleUrl = await envOrPrompt("BINDLE_URL", { prompt: "Enter Bindle server URL", placeHolder: "http://bindle.local.fermyon.link/v1", ignoreFocusOut: true });
    if (!bindleUrl) {
        return cancelled();
    }
    const hippoUrl = await envOrPrompt("HIPPO_URL", { prompt: "Enter Hippo server URL", placeHolder: "http://hippo.local.fermyon.link", ignoreFocusOut: true });
    if (!hippoUrl) {
        return cancelled();
    }
    const hippoUsername = await envOrPrompt("HIPPO_USERNAME", { prompt: "Enter Hippo user name", placeHolder: "name", ignoreFocusOut: true });
    if (!hippoUsername) {
        return cancelled();
    }
    const hippoPassword = await envOrPrompt("HIPPO_PASSWORD", { prompt: "Enter Hippo password", password: true, ignoreFocusOut: true });
    if (!hippoPassword) {
        return cancelled();
    }

    return accepted({
        bindleUrl,
        hippoUrl,
        hippoUsername,
        hippoPassword,
    });
}

async function envOrPrompt(env: string, promptOpts: vscode.InputBoxOptions): Promise<string | undefined> {
    return process.env[env] ||
        await vscode.window.showInputBox(promptOpts);
}

type UnsavedEnvironmentInfo =
    { toSave: 'all' } |
    { toSave: 'password', envName: string } |
    { toSave: 'none' };
