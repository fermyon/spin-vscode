import * as path from 'path';

export function toolsFolder(): string {
    return path.join(home(), `.fermyon/spin-vscode/tools`);
}

export function dataFolder(): string {
    return path.join(home(), `.fermyon/spin-vscode/data`);
}

function home(): string {
    return process.env['HOME'] ||
        concatIfSafe(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
}

function concatIfSafe(homeDrive: string | undefined, homePath: string | undefined): string | undefined {
    if (homeDrive && homePath) {
        const safe = !homePath.toLowerCase().startsWith('\\windows\\system32');
        if (safe) {
            return homeDrive.concat(homePath);
        }
    }

    return undefined;
}
