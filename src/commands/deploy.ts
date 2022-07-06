import * as vscode from 'vscode';

import * as spin from '../spin';
import { isOk } from '../errorable';
import * as output from '../output';
import { longRunningProcess } from '../longrunning';
import { activeEnvironment, FermyonEnvironment, getHippoPassword, saveEnvironment, saveHippoPassword } from '../fermyon/environment';
import { accepted, Cancellable, cancelled, isCancelled } from '../utils/cancellable';
import { cantHappen } from '../utils/never';
import { setActive } from '../fermyon/environment-ui';

export async function deploy(context: vscode.ExtensionContext) {
    const fermyonEnv = activeEnvironment();

    const deployParameters_ = await completeDeployParameters(context, fermyonEnv);
    if (isCancelled(deployParameters_)) {
        return;
    }
    const [deployParameters, unsaved] = deployParameters_.value;

    let state: DeployState | undefined = { state: 'deploying', parameters: deployParameters, unsaved, context };

    while (state !== undefined) {
        state = await runDeployStateMachine(state);
    }
}

// The login failure flows were breaking my brain so time to overengineer
// the heck out of this mofo

// * deploying -> succeeded
//                | redeploying [if already exists]
//                | getting new credentials [if login failed]
//                | failed
//   redeploying -> succeeded
//                  | getting new credentials [if login failed]
//                  | failed
//   getting new credentials -> redeploying [if new creds given, always redeploy because bindle upload would already have happened by this point]
//                              | TERMINATE [if new creds prompt cancelled]
//   succeded -> TERMINATE
//   failed -> TERMINATE

type DeployState =
    { state: 'deploying', parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext } |
    { state: 'succeeded', parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean, message: string } |
    { state: 'failed', message: string, existedBefore: boolean } |
    { state: 'redeploying', parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean } |
    { state: 'getting-new-credentials', parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean };

async function runDeployStateMachine(state: DeployState): Promise<DeployState | undefined> {
    switch (state.state) {
        case 'deploying':
            return await runDeploy(state.parameters, state.unsaved, state.context);
        case 'succeeded':
            return await runSucceeded(state.parameters, state.unsaved, state.context, state.existedBefore, state.message);
        case 'failed':
            return await runFailed(state.message, state.existedBefore);
        case 'redeploying':
            return await runRedeploy(state.parameters, state.unsaved, state.context, state.existedBefore);
        case 'getting-new-credentials':
            return await runGettingNewCredentials(state.parameters, state.unsaved, state.context, state.existedBefore);
        default:
            cantHappen(state);
    }
}

async function runDeploy(parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext): Promise<DeployState> {
    const result = await longRunningProcess("Spin deploy in progress...", (tok) =>
        spin.deploy(tok, parameters)
    );

    if (isOk(result)) {
        return { state: 'succeeded', parameters, unsaved, context, existedBefore: false, message: result.value };
    }

    if (result.message.includes('already exists on the server')) {
        output.appendLine(result.message);
        return { state: 'redeploying', parameters, unsaved, context, existedBefore: true };
    }

    if (result.message.includes('Login failed')) {
        output.appendLine(result.message);
        return { state: 'getting-new-credentials', parameters, unsaved, context, existedBefore: false };
    }

    return { state: 'failed', message: result.message, existedBefore: false };
}

async function runSucceeded(parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean, message: string): Promise<undefined> {
    output.appendLine(message);
    output.show();
    const description = existedBefore ? "deployment (reactivation)" : "deployment";
    await notifyDeploymentComplete(unsaved, description, context, parameters);
    return undefined;
}

async function runFailed(message: string, existedBefore: boolean): Promise<undefined> {
    output.appendLine(message);
    output.show();
    const description = existedBefore ? "deployment (reactivation)" : "deployment";
    await vscode.window.showErrorMessage(`Spin ${description} failed. See Output pane for details.`);
    return undefined;    
}

async function runRedeploy(parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean): Promise<DeployState> {
    const title = existedBefore ?
        "Spin deploy in progres..." :
        "Deployment exists, reactivating...";

    const result = await longRunningProcess(title, (tok) =>
        spin.deploy(tok, parameters, true)
    );

    if (isOk(result)) {
        return { state: 'succeeded', parameters, unsaved, context, existedBefore, message: result.value };
    }

    if (result.message.includes('Login failed')) {
        output.appendLine(result.message);
        return { state: 'getting-new-credentials', parameters, unsaved, context, existedBefore: existedBefore };
    }

    return { state: 'failed', message: result.message, existedBefore: existedBefore };
}

async function runGettingNewCredentials(parameters: spin.DeployParameters, unsaved: UnsavedEnvironmentInfo, context: vscode.ExtensionContext, existedBefore: boolean): Promise<DeployState | undefined> {
    const prompt = `Login failed. Please enter password for ${parameters.hippoUsername}`;
    const password = await vscode.window.showInputBox({ prompt, password: true });
    if (!password) {
        return undefined;
    }

    const newParameters = { ...parameters, hippoPassword: password };

    // What is now unsaved, given this new password?  If we were already in
    // 'everything unsaved' (i.e. no environment) then that's still the case.
    // If we were in already in 'password unsaved' (i.e. environment without
    // password) then that's till the case too!  But if we were in 'nothing
    // unsaved' (i.e. environment with password) then we need to go to 'password
    // unsaved'.
    const newUnsaved: UnsavedEnvironmentInfo = (unsaved.toSave === 'none') ?
        { toSave: 'password', envName: unsaved.envName } :
        unsaved;

    return { state: 'redeploying', parameters: newParameters, unsaved: newUnsaved, context, existedBefore };
}

async function notifyDeploymentComplete(unsaved: UnsavedEnvironmentInfo, description: string, context: vscode.ExtensionContext, deployParameters: spin.DeployParameters) {
    const message = `Spin ${description} complete. See output pane for application URL.`;
    if (unsaved.toSave === 'none') {
        await vscode.window.showInformationMessage(message);
    } else if (unsaved.toSave === 'password') {
        // TODO: is this going to get bothersome if the user already intentionally chose
        // "save without password"?
        const savePassword = await vscode.window.showInformationMessage(message, "Save Password");
        if (savePassword) {
            await saveHippoPassword(context, unsaved.envName, deployParameters.hippoPassword);
        }
    } else if (unsaved.toSave === 'all') {
        const saveChoice = await vscode.window.showInformationMessage(message, "Save Deployment Settings", "Save Without Password");
        if (saveChoice) {
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
            const passwoprdToSave = (saveChoice === 'Save Deployment Settings' ? deployParameters.hippoPassword : undefined);
            await saveEnvironment(context, environment, passwoprdToSave);
            await setActive(context, environment);
        }
    } else {
        cantHappen(unsaved);
    }
}

async function completeDeployParameters(context: vscode.ExtensionContext, fermyonEnv: FermyonEnvironment | undefined): Promise<Cancellable<[spin.DeployParameters, UnsavedEnvironmentInfo]>> {
    if (fermyonEnv) {
        const hippoPassword = await getHippoPassword(context, fermyonEnv.name);
        if (hippoPassword) {
            return accepted([{ hippoPassword, ...fermyonEnv}, { toSave: 'none', envName: fermyonEnv.name }]);
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
    { toSave: 'none', envName: string };
