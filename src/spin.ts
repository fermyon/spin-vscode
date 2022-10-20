import { CancellationToken } from 'vscode';
import { Errorable, isErr, ok } from './errorable';
import { ensureSpinInstalled } from './installer';
import * as shell from './utils/shell';
import * as output from './output';

async function invokeObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const binOpt = await ensureSpinInstalled();
    if (isErr(binOpt)) {
        return binOpt;
    }
    const bin = binOpt.value;

    const cmd = `${bin} ${command} ${args}`;
    output.appendLine(`$ ${cmd}`);
    return await sh.execObj<T>(
        cmd,
        `spin ${command}`,
        opts,
        andLog(fn)
    );
}

function andLog<T>(fn: (s: string) => T): (s: string) => T {
    return (s: string) => {
        output.appendLine(s);
        return fn(s);
    };
}

export async function deploy(token: CancellationToken, reactivateExisting?: boolean): Promise<Errorable<shell.RunningProcess>> {
    const binOpt = await ensureSpinInstalled();
    if (isErr(binOpt)) {
        return binOpt;
    }
    const bin = binOpt.value;

    const args = reactivateExisting ? ['--deploy-existing-bindle'] : [];
    return ok(shell.invokeErrFeed(bin, ['deploy', ...args], {}, token));
}

export interface BindleCredentials {
    readonly username: string,
    readonly password: string;
}

export async function loginBasic(
    sh: shell.Shell,
    hippoUrl: string,
    hippoUsername: string,
    hippoPassword: string,
    bindleUrl: string,
    bindleCredentials: BindleCredentials | undefined,
    allowInsecure: boolean
): Promise<Errorable<null>> {
    const insecure = allowInsecure ? "-k" : "";
    const args = `--auth-method username ${insecure}`;
    // Doing it this way simplifies escaping issues
    const bonusEnv = {
        HIPPO_URL: hippoUrl,
        HIPPO_USERNAME: hippoUsername,
        HIPPO_PASSWORD: hippoPassword,
        BINDLE_URL: bindleUrl,
        BINDLE_USERNAME: bindleCredentials?.username,
        BINDLE_PASSWORD: bindleCredentials?.password,
    };
    const env = { ...process.env, ...bonusEnv };
    const opts = { env };
    return await invokeObj(sh, 'login', args, opts, (_) => null);
}

export interface DeviceCodeInfo {
    readonly userCode: string,
    readonly deviceCode: string,
    readonly verificationUrl: string,
}

export interface DeviceAuthState {
    readonly state: 'authorised' | 'waiting' | 'error',
    readonly error?: string;
}

export async function loginGetDeviceCode(
    sh: shell.Shell,
    url: string | undefined,
    allowInsecure: boolean
): Promise<Errorable<DeviceCodeInfo>> {
    function parse(s: string): DeviceCodeInfo {
        return JSON.parse(s);
    }
    const insecure = allowInsecure ? "-k" : "";
    const urlArgs = url ? `--url ${url}` : "";
    const args = `--get-device-code ${urlArgs} ${insecure}`;
    return await invokeObj(sh, 'login', args, {}, parse);
}

export async function loginCheckDeviceCode(
    sh: shell.Shell,
    url: string,
    deviceCode: string,
    allowInsecure: boolean
): Promise<Errorable<DeviceAuthState>> {
    function parse(s: string): DeviceAuthState {
        // output is:
        //   Error: no token info
        // or:
        //   { token: ..., expirationDate: ... }
        try {
            const json = JSON.parse(s);
            if (json && json.token) {
                return { state: 'authorised' };
            }
            return { state: 'waiting' };
        } catch {
            return { state: 'waiting' };
        }
    }
    const insecure = allowInsecure ? "-k" : "";
    const args = `--check-device-code ${deviceCode} --url ${url} ${insecure}`;
    return await invokeObj(sh, 'login', args, {}, parse);
}

export async function loginStatus(sh: shell.Shell): Promise<Errorable<LoginStatus | undefined>> {
    // TODO: determine flags, output format, etc.
    function parse(s: string) {
        const json = JSON.parse(s);
        if (json.url) {
            return { dashboardUrl: json.url };
        } else {
            return undefined;
        }
    }
    const args = `--status`;
    return await invokeObj(sh, 'login', args, {}, parse);
}

export async function loginList(sh: shell.Shell): Promise<Errorable<ReadonlyArray<string>>> {
    function parse(s: string) {
        const lines = s.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        // TODO: how to deal with default?
        return lines;
    }
    return await invokeObj(sh, 'login', '--list', {}, parse);
}

export interface LoginStatus {
    readonly dashboardUrl: string;
}
