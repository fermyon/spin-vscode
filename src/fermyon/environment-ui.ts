import * as vscode from 'vscode';
import { accepted, Cancellable, cancelled } from '../utils/cancellable';
import { setAmbientContext } from '../utils/context';
import { activeEnvironment, activeEnvironmentNameConfig, allEnvironmentsConfig, FermyonEnvironment, getHippoPassword, saveActive } from './environment';
import { FERMYON_STATUS_BAR_ITEM } from './statusbar';

const SPIN_CONNECTED_CONTEXT = "spin.connected";

// Proposed experience:
// - You can have multiple environments defined
// - You can have an active environment or no active environment
// - If you have an active environment then it is used for deployment operations
// - If not then it uses the current logic

export async function promptSwitch(context: vscode.ExtensionContext): Promise<Cancellable<FermyonEnvironment | undefined>> {
    const activeEnvironmentName = activeEnvironmentNameConfig();
    const allEnvironments = allEnvironmentsConfig();

    if (allEnvironments.length === 0) {
        await vscode.window.showInformationMessage("There are no other Fermyon environments defined.");
        return cancelled();
    }

    const otherEnvironments = allEnvironments.filter(e => e.name !== activeEnvironmentName);
    const quickPicks = otherEnvironments.map(asQuickPick);
    quickPicks.unshift({ label: '(None)', description: 'Disconnects from all environments', environment: undefined });

    const selected = await vscode.window.showQuickPick(
        quickPicks,
        { placeHolder: 'Environment to switch to' }
    );
    if (!selected) {
        return cancelled();
    }

    const selectedEnvironment = selected.environment;
    await setActive(context, selectedEnvironment);
    return accepted(selectedEnvironment);
}

export async function setActive(context: vscode.ExtensionContext, environment: FermyonEnvironment | undefined) {
    await saveActive(environment?.name);
    await setUI(context, environment);
}

export async function showActiveEnvironmentUI(context: vscode.ExtensionContext) {
    const environment = activeEnvironment();
    await setUI(context, environment);
}

function asQuickPick(environment: FermyonEnvironment): vscode.QuickPickItem & { readonly environment: FermyonEnvironment | undefined } {
    return {
        label: environment.name,
        description: `(dashboard: ${environment.hippoUrl})`,
        environment,
    };
}

async function setUI(context: vscode.ExtensionContext, environment: FermyonEnvironment | undefined) {
    if (environment === undefined) {
        FERMYON_STATUS_BAR_ITEM.hide();
        await clearTerminalEnvironment(context);
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, false);
    } else {
        FERMYON_STATUS_BAR_ITEM.show(environment.name, environment.hippoUrl);
        await setTerminalEnvironment(context, environment);
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, true);
    }
}

async function setTerminalEnvironment(context: vscode.ExtensionContext, environment: FermyonEnvironment) {
    context.environmentVariableCollection.replace("BINDLE_URL", environment.bindleUrl);
    context.environmentVariableCollection.replace("HIPPO_URL", environment.hippoUrl);
    context.environmentVariableCollection.replace("HIPPO_USERNAME", environment.hippoUsername);

    const hippoPassword = await getHippoPassword(context, environment.name);
    if (hippoPassword) {
        context.environmentVariableCollection.replace("HIPPO_PASSWORD", hippoPassword);
    } else {
        context.environmentVariableCollection.delete("HIPPO_PASSWORD");
    }
}

async function clearTerminalEnvironment(context: vscode.ExtensionContext) {
    context.environmentVariableCollection.delete("BINDLE_URL");
    context.environmentVariableCollection.delete("HIPPO_URL");
    context.environmentVariableCollection.delete("HIPPO_USERNAME");
    context.environmentVariableCollection.delete("HIPPO_PASSWORD");
}
