import * as shelljs from 'shelljs';
import * as vscode from 'vscode';

import { err, Errorable, ok } from '../errorable';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export interface ExecOpts {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly async?: boolean;
}

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    platform(): Platform;
    home(): string;
    combinePath(basePath: string, relativePath: string): string;
    fileUri(filePath: string): vscode.Uri;
    execOpts(): ExecOpts;
    exec(cmd: string, stdin?: string): Promise<Errorable<ShellResult>>;
    execObj<T>(cmd: string, cmdDesc: string, opts: ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>>;
    execCore(cmd: string, opts: ExecOpts, stdin?: string): Promise<ShellResult>;
    execToFile(cmd: string, dest: string, opts: ExecOpts): Promise<ShellResult>;
    unquotedPath(path: string): string;
}

export const shell: Shell = {
    isWindows: isWindows,
    isUnix: isUnix,
    platform: platform,
    home: home,
    combinePath: combinePath,
    fileUri: fileUri,
    execOpts: execOpts,
    exec: exec,
    execObj: execObj,
    execCore: execCore,
    execToFile: execToFile,
    unquotedPath: unquotedPath,
};

const WINDOWS = 'win32';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;

function isWindows(): boolean {
    return (process.platform === WINDOWS);
}

function isUnix(): boolean {
    return !isWindows();
}

function platform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: return Platform.Unsupported;
    }
}

function home(): string {
    return process.env['HOME'] || process.env['USERPROFILE'] || '';
}

function combinePath(basePath: string, relativePath: string) {
    let separator = '/';
    if (isWindows()) {
        relativePath = relativePath.replace(/\//g, '\\');
        separator = '\\';
    }
    return basePath + separator + relativePath;
}

function fileUri(filePath: string): vscode.Uri {
    if (isWindows()) {
        return vscode.Uri.parse('file:///' + filePath.replace(/\\/g, '/'));
    }
    return vscode.Uri.parse('file://' + filePath);
}

function execOpts(): ExecOpts {
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: process.env,
        async: true
    };
    return opts;
}

async function exec(cmd: string): Promise<Errorable<ShellResult>> {
    try {
        return ok(await execCore(cmd, execOpts()));
    } catch (ex) {
        return err(`Error invoking '${cmd}: ${ex}`);
    }
}

async function execObj<T>(cmd: string, cmdDesc: string, opts: ExecOpts, fn: ((stdout: string) => T)): Promise<Errorable<T>> {
    const o = Object.assign({}, execOpts(), opts);
    try {
        const sr = await execCore(cmd, o);
        if (sr.code === 0) {
            const value = fn(sr.stdout);
            return ok(value);
        } else {
            return err(`${cmdDesc} error: ${sr.stderr}`);
        }
    } catch (ex) {
        return err(`Error invoking '${cmd}: ${ex}`);
    }
}

function execCore(cmd: string, opts: ExecOpts): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve, _reject) => {
        shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({ code: code, stdout: stdout, stderr: stderr }));
    });
}

function execToFile(cmd: string, dest: string, opts: ExecOpts): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve, _reject) => {
        shelljs.exec(cmd + ` >${dest}`, opts, (code, stdout, stderr) => resolve({ code: code, stdout: stdout, stderr: stderr }));
    });
}

function unquotedPath(path: string): string {
    if (isWindows() && path && path.length > 1 && path.startsWith('"') && path.endsWith('"')) {
        return path.substring(1, path.length - 1);
    }
    return path;
}

export function safeValue(s: string): string {
    if (s.indexOf(' ') >= 0) {
        return `"${s}"`;  // TODO: confirm quoting style on Mac/Linux
    }
    return s;
}
