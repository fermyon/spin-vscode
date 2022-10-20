import * as vscode from 'vscode';
import { isOk } from '../errorable';
import { promptLogin } from "../fermyon/environment-ui";
import { isAccepted } from "../utils/cancellable";

export async function connect() {
    const switched = await promptLogin();
    if (isAccepted(switched) && isOk(switched.value)) {
        await vscode.window.showInformationMessage(`Logged into ${switched.value.value}`);
    }
}
