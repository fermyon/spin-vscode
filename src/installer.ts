import * as fs from 'fs';
import * as fsp from 'fs/promises';
import got from 'got';
import extract = require('extract-zip');
import mkdirp = require('mkdirp');
import * as path from 'path';
import * as tar from 'tar';
import * as tmp from 'tmp';
import * as config from './config';
import { Errorable, err, ok, isErr, isOk } from "./errorable";
import * as layout from './layout';
import { longRunning } from './longrunning';
import * as log from './logger';

// TODO: List available versions (can we use verman)?
// TODO: Get latest version
const SPIN_VERSION = "3.0.0-rc.1";
const SPIN_DONWLOAD_URL_TEMPLATE = `https://github.com/fermyon/spin/releases/download/v${SPIN_VERSION}/spin-v${SPIN_VERSION}-{{subst:os}}-{{subst:arch}}.{{subst:fmt}}`;
const SPIN_TOOL_NAME = "spin";
const SPIN_BIN_NAME = "spin";

export async function ensureSpinInstalled(): Promise<Errorable<string>> {
    log.info(ensureSpinInstalled.name, `Checking if Spin is installed`);

    const customPath = config.customPath();
    if (customPath) {
        log.info(ensureSpinInstalled.name, `Using the following custom path from configuration: ${customPath}`);
        return ok(customPath);
    }

    const toolFile = installLocation(SPIN_TOOL_NAME, SPIN_BIN_NAME);
    log.info(ensureSpinInstalled.name, `Checking for Spin at: ${toolFile}`);
    if (!fs.existsSync(toolFile) || !isInstallCurrent()) {
        log.info(ensureSpinInstalled.name, `Didn't find Spin locally.`);
        const downloadResult = await longRunning(`Downloading Spin ${SPIN_VERSION}...`, () =>
            downloadSpinTo(toolFile)
        );
        if (isErr(downloadResult)) {
            log.info(ensureSpinInstalled.name, `Error installing Spin: ${downloadResult}`);
            return downloadResult;
        }
    }    
    markInstallCurrent();
    log.info(ensureSpinInstalled.name, `Spin installed at: ${toolFile}`);
    return ok(toolFile);
}

async function downloadSpinTo(toolFile: string): Promise<Errorable<null>> {
    const toolDir = path.dirname(toolFile);

    const sourceUrl = downloadSource();
    if (isErr(sourceUrl)) {
        return sourceUrl;
    }

    mkdirp.sync(toolDir);

    const downloadResult = await downloadToTempFile(sourceUrl.value);
    if (isErr(downloadResult)) {
        return downloadResult;
    }

    const archiveFile = downloadResult.value;
    const unarchiveResult = await unarchive(archiveFile, toolDir);

    return unarchiveResult;
}

function downloadSource(): Errorable<string> {
    const osId = os();
    const archId = arch();
    const fmtId = fmt();

    if (osId === null || archId === null) {
        return err("Unsupported operating system or processor architecture");
    }

    const url = SPIN_DONWLOAD_URL_TEMPLATE.replace("{{subst:os}}", osId).replace("{{subst:arch}}", archId).replace("{{subst:fmt}}", fmtId);
    return ok(url);
}

export function installLocation(tool: string, bin: string): string {
    // The ideal is to cache in extension storage (ExtensionContext::globalStorage)
    // but exec can only run from a plain ol' file path, so file path it is.
    const basePath = layout.toolsFolder();
    const toolPath = path.join(basePath, tool, `current`);
    const binSuffix = process.platform === 'win32' ? '.exe' : '';
    const toolFile = path.join(toolPath, bin + binSuffix);
    return toolFile;
}

function isInstallCurrent(): boolean {
    const versionFile = installedVersionLocation(SPIN_TOOL_NAME);
    if (!fs.existsSync(versionFile)) {
        return false;
    }
    const text = fs.readFileSync(versionFile, { encoding: 'utf-8' });
    return text.trim() === SPIN_VERSION;
}

function markInstallCurrent() {
    const versionFile = installedVersionLocation(SPIN_TOOL_NAME);
    fs.writeFileSync(versionFile, SPIN_VERSION, { encoding: 'utf-8' });
}

function installedVersionLocation(tool: string): string {
    const basePath = layout.toolsFolder();
    const versionPath = path.join(basePath, tool, `current-version.txt`);
    return versionPath;
}

function os(): string | null {
    switch (process.platform) {
        case 'win32': return 'windows';
        case 'darwin': return 'macos';
        case 'linux': return 'linux';
        default: return null;
    }
}

function arch(): string | null {
    switch (process.arch) {
        case 'arm64':
            return process.platform === 'darwin' ? 'aarch64' : 'arm64';
        case 'x64':
            return "amd64";
        default:
            return null;
    }
}

function fmt(): string {
    switch (process.platform) {
        case 'win32': return 'zip';
        default: return 'tar.gz';
    }
}

async function unarchive(sourceFile: string, destinationFolder: string): Promise<Errorable<null>> {
    switch (process.platform) {
        case 'win32': return unzip(sourceFile, destinationFolder);
        default: return untar(sourceFile, destinationFolder);
    }
}

async function download(url: string, destinationFile: string) {
    const response = await got(url).buffer();
    await mkdirp(path.dirname(destinationFile));
    await fsp.writeFile(destinationFile, response);
}

async function downloadTo(sourceUrl: string, destinationFile: string): Promise<Errorable<null>> {
    try {
        await download(sourceUrl, destinationFile);
        return ok(null);
    } catch (e) {
        return err((e as Error).message);
    }
}

async function downloadToTempFile(sourceUrl: string): Promise<Errorable<string>> {
    const tempFileObj = tmp.fileSync({ prefix: `${SPIN_TOOL_NAME}-autoinstall-` });
    const downloadResult = await downloadTo(sourceUrl, tempFileObj.name);
    if (isOk(downloadResult)) {
        return ok(tempFileObj.name);
    }
    return err(downloadResult.message);
}

async function untar(sourceFile: string, destinationFolder: string): Promise<Errorable<null>> {
    try {
        if (!fs.existsSync(destinationFolder)) {
            mkdirp.sync(destinationFolder);
        }
        await tar.x({
            cwd: destinationFolder,
            file: sourceFile
        });
        return ok(null);
    } catch (e) {
        console.log(e);
        return err("tar extract failed");
    }
}

async function unzip(sourceFile: string, destinationFolder: string): Promise<Errorable<null>> {
    try {
        if (!fs.existsSync(destinationFolder)) {
            mkdirp.sync(destinationFolder);
        }
        await extract(sourceFile, { dir: destinationFolder });
        return ok(null);
    } catch (e) {
        console.log(e);
        return err("zip extract failed");
    }
}
