import * as vscode from 'vscode';

export interface FermyonStatusBarItem {
    show(dashboardAddress: string): void;
    hide(): void;
}

export function newStatusBarItem(): FermyonStatusBarItem {
    return new FermyonStatusBarItemImpl();
}

class FermyonStatusBarItemImpl implements FermyonStatusBarItem {
    private item: vscode.StatusBarItem | null;
    constructor() {
        this.item = null;
    }

    show(dashboardAddress: string) {
        if (this.item === null) {
            this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
            this.item.text = "Fermyon";
            this.item.command = "spin.onStatusBarItemClicked";
        }
        this.item.tooltip = `Logged into ${dashboardAddress}`;
        this.item.show();
    }

    hide() {
        if (this.item !== null) {
            this.item.hide();
        }
    }
}

export async function onStatusBarItemClicked() {
    // TODO: is there a way to keep these in sync with the titles in
    // package.json?
    const commands = [
        { label: "Spin: Change Login", command: "spin.connect" },
        { label: "Spin: Open Dashboard", command: "spin.openDashboard" },
    ];

    const commandPick = await vscode.window.showQuickPick(commands);

    if (commandPick) {
        vscode.commands.executeCommand(commandPick.command);
    }
}

export const FERMYON_STATUS_BAR_ITEM: FermyonStatusBarItem = new FermyonStatusBarItemImpl();
