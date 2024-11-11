import * as vscode from 'vscode';

const OUTPUT_CHANNEL = vscode.window.createOutputChannel("Spin", );

let shownInstallErrorToast = false;

enum logLevel {
    Info = "Info",
    Warning = "Warning",
    Error = "Error",
} 

interface logMessage {
    level: logLevel,
    function: string,
    message: string,
}

export function info(caller: string, message: string) {
    const log: logMessage = {
        level:logLevel.Info,
        function: caller,
        message: message
    };
    OUTPUT_CHANNEL.appendLine(formatLog(log));
}

export function warning(caller: string, message: string) {
    const log: logMessage = {
        level:logLevel.Warning,
        function: caller,
        message: message
    };
    OUTPUT_CHANNEL.appendLine(formatLog(log));
}

export function error(caller: string, message: string) {
    const log: logMessage = {
        level:logLevel.Error,
        function: caller,
        message: message
    };
    OUTPUT_CHANNEL.appendLine(formatLog(log));
}

export function logMessage(logMessage: logMessage) {
    OUTPUT_CHANNEL.appendLine(formatLog(logMessage));
}

export function warnInstallNotEnsured(message: string, always?: 'always' | 'if-not-shown') {
    if (!shownInstallErrorToast || always === 'always') {
        shownInstallErrorToast = true;
        vscode.window.showWarningMessage(message);
    } else {
        warning(warnInstallNotEnsured.name, message);
    }
}

export function show(preserveFocus?: boolean) {
    OUTPUT_CHANNEL.show(preserveFocus);
}

function formatLog(log: logMessage): string {
    const date = new Date().toISOString();
    return `${date} [${log.level}] ${log.message}`;
}