import * as path from 'path';
import xdg = require('xdg-portable/cjs');

const EXTENSION_FOLDER = "spin-vscode";

export function toolsFolder(): string {
    return path.join(cacheFolder(), `tools`);
}

function cacheFolder(): string {
    return path.join(xdg.cache(), EXTENSION_FOLDER);
}
