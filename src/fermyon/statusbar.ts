import * as vscode from 'vscode';

export interface FermyonStatusBarItem {
    show(environmentName: string, dashboardAddress: string): void;
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

    show(environmentName: string, dashboardAddress: string) {
        if (this.item === null) {
            this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
            this.item.text = "Fermyon";
        }
        this.item.tooltip = `Dashboard URL: ${dashboardAddress}\nData environment: ${environmentName}`;
        this.item.show();
    }

    hide() {
        if (this.item !== null) {
            this.item.hide();
        }
    }
}

export const FERMYON_STATUS_BAR_ITEM: FermyonStatusBarItem = new FermyonStatusBarItemImpl();
