import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const disposables = [
		vscode.commands.registerCommand('spin-vscode.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from spin-vscode!');
		})
]	;

	context.subscriptions.push(...disposables);
}

export function deactivate() {
	// nothing to do here
}
