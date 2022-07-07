import { CancellationToken } from 'vscode';
import { Errorable, isErr, ok } from './errorable';
import { ensureSpinInstalled } from './installer';
import * as shell from './utils/shell';

// async function invokeObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
//     const binOpt = await ensureSpinInstalled();
//     if (isErr(binOpt)) {
//         return binOpt;
//     }
//     const bin = binOpt.value;

//     const cmd = `${bin} ${command} ${args}`;
//     output.appendLine(`$ ${cmd}`);
//     return await sh.execObj<T>(
//         cmd,
//         `spin ${command}`,
//         opts,
//         andLog(fn)
//     );
// }

// function andLog<T>(fn: (s: string) => T): (s: string) => T {
//     return (s: string) => {
//         output.appendLine(s);
//         return fn(s);
//     };
// }

// export async function deploy(sh: shell.Shell, reactivateExisting?: boolean): Promise<Errorable<string>> {
//     const args = reactivateExisting ? '--deploy-existing-bindle' : '';
//     return await invokeObj(sh, 'deploy', args, {}, (s) => s);
// }

export async function deploy(token: CancellationToken, parameters: DeployParameters, reactivateExisting?: boolean): Promise<Errorable<shell.RunningProcess>> {
    const binOpt = await ensureSpinInstalled();
    if (isErr(binOpt)) {
        return binOpt;
    }
    const bin = binOpt.value;

    const args = reactivateExisting ? ['--deploy-existing-bindle'] : [];
    const bonusEnv = toEnv(parameters);
    return ok(shell.invokeErrFeed(bin, ['deploy', ...args], bonusEnv, token));
}

export interface DeployParameters {
    readonly bindleUrl: string;
    readonly hippoUrl: string;
    readonly hippoUsername: string;
    readonly hippoPassword: string;
}

function toEnv(deployParameters: DeployParameters): { [key: string]: string } {
    return {
        BINDLE_URL: deployParameters.bindleUrl,
        HIPPO_URL: deployParameters.hippoUrl,
        HIPPO_USERNAME: deployParameters.hippoUsername,
        HIPPO_PASSWORD: deployParameters.hippoPassword,
    };
}
