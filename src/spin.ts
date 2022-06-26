import { CancellationToken } from 'vscode';
import { Errorable, isErr, ok } from './errorable';
import { ensureSpinInstalled } from './installer';
import * as output from './output';
import * as shell from './utils/shell';

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

export async function deploy(sh: shell.Shell, reactivateExisting?: boolean): Promise<Errorable<string>> {
    const args = reactivateExisting ? '--deploy-existing-bindle' : '';
    return await invokeObj(sh, 'deploy', args, {}, (s) => s);
}

export async function deploy2(token: CancellationToken, reactivateExisting?: boolean): Promise<Errorable<shell.RunningProcess>> {
    const binOpt = await ensureSpinInstalled();
    if (isErr(binOpt)) {
        return binOpt;
    }
    const bin = binOpt.value;

    const args = reactivateExisting ? ['--deploy-existing-bindle'] : [];
    return ok(shell.invokeTracking(bin, ['deploy', ...args], token));
}

export async function deploy3(token: CancellationToken, bonusEnv: { [key: string]: string }, reactivateExisting?: boolean): Promise<Errorable<shell.RunningProcess2>> {
    const binOpt = await ensureSpinInstalled();
    if (isErr(binOpt)) {
        return binOpt;
    }
    const bin = binOpt.value;

    const args = reactivateExisting ? ['--deploy-existing-bindle'] : [];
    return ok(shell.invokeErrFeed(bin, ['deploy', ...args], bonusEnv, token));
}
