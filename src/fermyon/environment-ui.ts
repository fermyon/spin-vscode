import * as vscode from 'vscode';
import { accepted, Cancellable, cancelled, isCancelled } from '../utils/cancellable';
import { setAmbientContext } from '../utils/context';
import { FERMYON_STATUS_BAR_ITEM } from './statusbar';
import * as spin from '../spin';
import { shell } from '../utils/shell';
import { Errorable, isErr, ok } from '../errorable';
import { cantHappen } from '../utils/never';
import { FERMYON_DEFAULT_URL } from './environment';

const SPIN_CONNECTED_CONTEXT = "spin.connected";

const LOGIN_PROMPT_TITLE = 'Spin: Log In';

export async function promptLogin(): Promise<Cancellable<Errorable<string>>> {
    const result = await login();
    showActiveEnvironmentUI();
    return result;
}

const DEFAULT_HOST = 'Fermyon Cloud';
const GH_AUTH_INSTANCE = 'Platform using GitHub authentication';
const BASIC_AUTH_INSTANCE = 'Default Fermyon Platform using username and password';

async function login(): Promise<Cancellable<Errorable<string>>> {
    const choice = await vscode.window.showQuickPick([DEFAULT_HOST, GH_AUTH_INSTANCE, BASIC_AUTH_INSTANCE]);
    if (!choice) {
        return cancelled();
    }

    if (choice === DEFAULT_HOST) {
        return await loginDefaultHost();
    } else if (choice === GH_AUTH_INSTANCE) {
        const url = await vscode.window.showInputBox({ title: "Enter platform URL", value: process.env["HIPPO_URL"], ignoreFocusOut: true });
        if (!url) {
            return cancelled();
        }
        return await loginGitHubAuth(url, false);
    } else {
        return await loginBasicAuth();
    }
}

async function loginBasicAuth(): Promise<Cancellable<Errorable<string>>> {
    const hippoUrl = await vscode.window.showInputBox({ title: "Enter Hippo URL", value: process.env["HIPPO_URL"], ignoreFocusOut: true });
    if (!hippoUrl) {
        return cancelled();
    }

    const bindleUrl = await vscode.window.showInputBox({ title: "Enter Bindle URL", value: process.env["BINDLE_URL"], ignoreFocusOut: true });
    if (!bindleUrl) {
        return cancelled();
    }

    const didLogIn = await loginBasicAuthDoLogin(hippoUrl, bindleUrl);

    if (isCancelled(didLogIn)) {
        return cancelled();
    }
    if (isErr(didLogIn.value)) {
        return accepted(didLogIn.value);
    }
    return accepted(ok(hippoUrl));
}

async function loginBasicAuthDoLogin(hippoUrl: string, bindleUrl: string): Promise<Cancellable<Errorable<null>>> {
    const envVarsMatch =
        (process.env["HIPPO_URL"] === hippoUrl) &&
        process.env["HIPPO_USERNAME"] &&
        process.env["HIPPO_PASSWORD"];

    const credentials = envVarsMatch ?
        basicCredentialsFromEnvironmentVariables() :
        await basicCredentialsFromPrompt();

    if (isCancelled(credentials)) {
        return cancelled();
    }

    const [hippoUsername, hippoPassword, bindleCredentials] = credentials.value;

    const loginResult = await spin.loginBasic(shell, hippoUrl, hippoUsername, hippoPassword, bindleUrl, bindleCredentials, false);
    return accepted(loginResult);
}

function basicCredentialsFromEnvironmentVariables(): Cancellable<[string, string, spin.BindleCredentials | undefined]> {
    const hippoUsername = process.env["HIPPO_USERNAME"] || '';
    const hippoPassword = process.env["HIPPO_PASSWORD"] || '';
    const bindleCredentials = process.env["BINDLE_USERNAME"] ?
        { username: process.env["BINDLE_USERNAME"] || '', password: process.env["BINDLE_PASSWORD"] || '' } :
        undefined;
    return accepted([hippoUsername, hippoPassword, bindleCredentials]);
}

async function basicCredentialsFromPrompt(): Promise<Cancellable<[string, string, spin.BindleCredentials | undefined]>> {
    const hippoUsername = await vscode.window.showInputBox({ title: LOGIN_PROMPT_TITLE, prompt: "Enter Hippo user name", placeHolder: "name", ignoreFocusOut: true });
    if (!hippoUsername) {
        return cancelled();
    }

    const hippoPassword = await vscode.window.showInputBox({ title: LOGIN_PROMPT_TITLE, prompt: "Enter Hippo password", password: true, ignoreFocusOut: true });
    if (!hippoPassword) {
        return cancelled();
    }

    const bindleCredentials = await promptBindleCredentials();
    if (isCancelled(bindleCredentials)) {
        return cancelled();
    }

    return accepted([hippoUsername, hippoPassword, bindleCredentials.value]);
}

async function promptBindleCredentials(): Promise<Cancellable<spin.BindleCredentials | undefined>> {
    const username = await vscode.window.showInputBox({ title: LOGIN_PROMPT_TITLE, prompt: "Enter Bindle user name (leave blank for unauthenticated)", ignoreFocusOut: true });
    if (username === undefined) {
        return cancelled();
    }
    if (username.length === 0) {
        return accepted(undefined);
    }

    const password = await vscode.window.showInputBox({ title: LOGIN_PROMPT_TITLE, prompt: "Enter Bindle password", password: true, ignoreFocusOut: true });
    if (password === undefined) {
        return cancelled();
    }

    return accepted({ username, password });
}

async function loginDefaultHost(): Promise<Cancellable<Errorable<string>>> {
    return await loginGitHubAuth(FERMYON_DEFAULT_URL, false);
}

function interactionPrompt(state: spin.DeviceAuthState | { state: 'browser-opened' } | undefined, deviceCodeInfo: spin.DeviceCodeInfo): string {
    if (state === undefined) {
        return `To complete authorization, open your browser to ${deviceCodeInfo.verificationUrl} and enter code ${deviceCodeInfo.userCode}.`;
    }

    switch (state.state) {
        case 'authorised':
            return '';
        case 'browser-opened':
            return `Please paste code ${deviceCodeInfo.userCode} into the browser at ${deviceCodeInfo.verificationUrl}, then choose Done.`;
        case 'waiting':
            return `Still waiting for authorization. Please open your browser to ${deviceCodeInfo.verificationUrl} and enter code ${deviceCodeInfo.userCode}, then choose Done.`;
        case 'error':
            return `Error checking for authorization. Please open your browser to ${deviceCodeInfo.verificationUrl} and enter code ${deviceCodeInfo.userCode}, or cancel if error persists.`;
        default:
            return cantHappen(state);
    }
}

async function loginGitHubAuth(url: string, allowInsecure: boolean): Promise<Cancellable<Errorable<string>>> {
    // TODO: we might need to prevent this process inheriting any HIPPO_* and BINDLE_* EVs
    // - causes unexpected errors
    const deviceCodeInfoResult = await spin.loginGetDeviceCode(shell, url, allowInsecure);
    if (isErr(deviceCodeInfoResult)) {
        return accepted(deviceCodeInfoResult);
    }
    const deviceCodeInfo = deviceCodeInfoResult.value;

    let authState: spin.DeviceAuthState | { state: 'browser-opened' } | undefined = undefined;
    for (;;) {
        const message = interactionPrompt(authState, deviceCodeInfo);
        const copyButton = (authState?.state === 'browser-opened') ?
            'Re-copy Code and Open Browser' as const :
            'Copy Code and Open Browser' as const;
        const choice = await vscode.window.showInformationMessage(message, copyButton, 'Done', 'Cancel');
        if (choice === 'Cancel') {
            return cancelled();
        }
        if (choice === copyButton) {
            await vscode.env.clipboard.writeText(deviceCodeInfo.userCode);
            await vscode.env.openExternal(vscode.Uri.parse(deviceCodeInfo.verificationUrl));
            authState = { state: 'browser-opened' };
            continue;
        }
        const authStateResult = await spin.loginCheckDeviceCode(shell, url, deviceCodeInfo.deviceCode, allowInsecure);
        if (isErr(authStateResult)) {
            return accepted(authStateResult);
        }
        if (authStateResult.value.state === 'authorised') {
            return accepted(ok(url));
        }
        authState = authStateResult.value;
    }
}

export async function showActiveEnvironmentUI() {
    const loginStatusResult = await spin.loginStatus(shell);
    if (isErr(loginStatusResult)) {
        FERMYON_STATUS_BAR_ITEM.hide();
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, false);
        return;
    }
    const loginStatus = loginStatusResult.value;

    if (loginStatus === undefined) {
        FERMYON_STATUS_BAR_ITEM.hide();
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, false);
    } else {
        FERMYON_STATUS_BAR_ITEM.show(loginStatus.dashboardUrl);
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, true);
    }
}
