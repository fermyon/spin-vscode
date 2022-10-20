import * as spin from '../spin';
import { shell } from '../utils/shell';
import { isErr } from '../errorable';

export const FERMYON_DEFAULT_URL = "http://localhost:5309";

export async function activeDashboard(): Promise<string | undefined> {
    const loginStatusResult = await spin.loginStatus(shell);
    if (isErr(loginStatusResult)) {
        return undefined;
    }
    const loginStatus = loginStatusResult.value;

    if (loginStatus === undefined) {
        return undefined;
    } else {
        return loginStatus.dashboardUrl;
    }
}
