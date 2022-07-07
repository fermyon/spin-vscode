import * as vscode from 'vscode';
import { promptSwitch } from "../fermyon/environment-ui";

export async function connect(context: vscode.ExtensionContext) {
    await promptSwitch(context);
}
