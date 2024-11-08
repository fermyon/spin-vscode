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
import { Octokit } from "@octokit/rest";

// Fallback version is used if the call to getLatestReleases() fails
const SPIN_VERSION_FALLBACK = "3.0.0";
const SPIN_TOOL_NAME = "spin";
const SPIN_BIN_NAME = "spin";

export async function ensureSpinInstalled(): Promise<Errorable<string>> {
    const spinVersion = await getLatestReleases();
    log.info(ensureSpinInstalled.name, `Checking if Spin ${spinVersion} is installed`);

    const customPath = config.customPath();
    if (customPath) {
        log.info(ensureSpinInstalled.name, `Using the following custom path from configuration: ${customPath}`);
        return ok(customPath);
    }

    const toolFile = installLocation(SPIN_TOOL_NAME, SPIN_BIN_NAME);
    log.info(ensureSpinInstalled.name, `Checking for Spin at: ${toolFile}`);
    if (!fs.existsSync(toolFile) || !isInstallCurrent(spinVersion)) {
        log.info(ensureSpinInstalled.name, `Didn't find Spin locally.`);
        const downloadResult = await longRunning(`Downloading Spin ${spinVersion}...`, () =>
            downloadSpinTo(toolFile, spinVersion)
        );
        if (isErr(downloadResult)) {
            log.error(ensureSpinInstalled.name, `Error installing Spin: ${JSON.stringify(downloadResult)}`);
            return downloadResult;
        }
    }    
    markInstallCurrent(spinVersion);
    log.info(ensureSpinInstalled.name, `Spin installed at: ${toolFile}`);
    return ok(toolFile);
}

async function downloadSpinTo(toolFile: string, spinVersion: string): Promise<Errorable<null>> {
    const toolDir = path.dirname(toolFile);

    const sourceUrl = downloadSource(spinVersion);
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

function downloadSource(spinVersion: string): Errorable<string> {
    const osId = os();
    const archId = arch();
    const fmtId = fmt();

    if (osId === null || archId === null) {
        return err("Unsupported operating system or processor architecture");
    }

    const url = `https://github.com/fermyon/spin/releases/download/${spinVersion}/spin-${spinVersion}-${osId}-${archId}.${fmtId}`;
    log.info(downloadSource.name, `"Download URI: ${url}`);
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

function isInstallCurrent(spinVersion: string): boolean {
    const versionFile = installedVersionLocation(SPIN_TOOL_NAME);
    if (!fs.existsSync(versionFile)) {
        return false;
    }
    const text = fs.readFileSync(versionFile, { encoding: 'utf-8' });
    return text.trim() === spinVersion;
}

function markInstallCurrent(spinVersion: string) {
    const versionFile = installedVersionLocation(SPIN_TOOL_NAME);
    fs.writeFileSync(versionFile, spinVersion, { encoding: 'utf-8' });
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

async function getLatestReleases(): Promise<string> {
    const octokit = new Octokit();
    const { data: release } = await octokit.rest.repos.getLatestRelease({
        owner: "fermyon",
        repo: "spin",
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (release.name === null) {
        return SPIN_VERSION_FALLBACK;
    } else {
        return release.name;
    }
}