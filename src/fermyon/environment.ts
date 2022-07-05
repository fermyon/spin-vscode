import * as vscode from 'vscode';
import { accepted, Cancellable, cancelled } from '../utils/cancellable';

// Proposed experience:
// - You can have multiple environments defined
// - You can have an active environment or no active environment
// - If you have an active environment then it is used for deployment operations
// - If not then it uses the current logic

// Longer term we may need to split this - not sure whether we should
// simply infer Terraform directories etc.
export interface FermyonEnvironment {
    readonly name: string;
    // readonly kind: 'local' | 'aws';
    readonly bindleUrl: string;
    readonly hippoUrl: string;
    readonly hippoUsername: string;
}

export function activeEnvironment(): FermyonEnvironment | undefined {
    const activeEnvironmentName = activeEnvironmentNameConfig();
    const allEnvironments = allEnvironmentsConfig();
    const activeEnvironment = allEnvironments.find(e => e.name === activeEnvironmentName);
    return activeEnvironment;
}

function hippoPasswordKey(environment: string): string {
    return `fermyon.${environment}.hippo.password`;
}

export async function getHippoPassword(context: vscode.ExtensionContext, environment: string): Promise<string | undefined> {
    const key = hippoPasswordKey(environment);
    return await context.secrets.get(key);
}

export async function saveHippoPassword(context: vscode.ExtensionContext, environment: string, password: string) {
    const key = hippoPasswordKey(environment);
    await context.secrets.store(key, password);
}

export async function saveEnvironment(context: vscode.ExtensionContext, environment: FermyonEnvironment, hippoPassword: string | undefined) {
    const allEnvironments = allEnvironmentsConfig();
    const existing = allEnvironments.findIndex(e => e.name === environment.name);
    if (existing >= 0) {
        allEnvironments.splice(existing, 1, environment);
    } else {
        allEnvironments.push(environment);
    }
    vscode.workspace.getConfiguration().update("spin.environments", allEnvironments, vscode.ConfigurationTarget.Global);

    if (hippoPassword) {
        await saveHippoPassword(context, environment.name, hippoPassword);
    }
}

export async function promptSwitch(): Promise<Cancellable<FermyonEnvironment | undefined>> {
    const activeEnvironmentName = activeEnvironmentNameConfig();
    const allEnvironments = allEnvironmentsConfig();

    if (allEnvironments.length === 0) {
        await vscode.window.showInformationMessage("There are no other Fermyon environments defined.");
        return cancelled();
    }

    const otherEnvironments = allEnvironments.filter(e => e.name !== activeEnvironmentName);
    const quickPicks = otherEnvironments.map(asQuickPick);
    quickPicks.unshift({ label: 'Disconnect', environment: undefined });

    const selected = await vscode.window.showQuickPick(
        quickPicks,
        { placeHolder: 'Environment to switch to' }
    );
    if (!selected) {
        return cancelled();
    }

    const selectedEnvironment = selected.environment;
    await setActive(selectedEnvironment?.name);
    return accepted(selectedEnvironment);
}

function activeEnvironmentNameConfig() {
    return vscode.workspace.getConfiguration().get<string>("spin.activeEnvironment");
}

function allEnvironmentsConfig() {
    return vscode.workspace.getConfiguration().get<FermyonEnvironment[]>("spin.environments") || [];
}

export async function setActive(environmentName: string | undefined) {
    await vscode.workspace.getConfiguration().update("spin.activeEnvironment", environmentName, vscode.ConfigurationTarget.Global);
}

export function environmentExists(environmentName: string): boolean {
    const allEnvironments = allEnvironmentsConfig();
    return allEnvironments.some(e => e.name === environmentName);
}

function asQuickPick(environment: FermyonEnvironment): vscode.QuickPickItem & { readonly environment: FermyonEnvironment | undefined } {
    return {
        label: environment.name,
        description: `(dashboard: ${environment.hippoUrl})`,
        environment,
    };
}
