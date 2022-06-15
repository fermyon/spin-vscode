import * as vscode from 'vscode';

function spinConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("spin");
}

export function customPath(): string | undefined {
    return spinConfiguration().get("customProgramPath");
}
