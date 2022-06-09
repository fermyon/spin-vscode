import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import * as stream from 'stream';
import * as tar from 'tar';
import * as tmp from 'tmp';
import { Errorable, err, ok, isErr, isOk } from "./errorable";
import * as layout from './layout';
import { longRunning } from './longrunning';

const SPIN_VERSION = "0.2.0";
const SPIN_DONWLOAD_URL_TEMPLATE = `https://github.com/fermyon/spin/releases/download/v${SPIN_VERSION}/spin-v${SPIN_VERSION}-{{subst:os}}-{{subst:arch}}.tar.gz`;
const SPIN_TOOL_NAME = "spin";
const SPIN_BIN_NAME = "spin";

export async function ensureSpinInstalled(): Promise<Errorable<string>> {
    const toolFile = installLocation(SPIN_TOOL_NAME, SPIN_BIN_NAME);
    if (!fs.existsSync(toolFile)) {
        const downloadResult = await longRunning(`Downloading Spin ${SPIN_VERSION}...`, () =>
            downloadSpinTo(toolFile)
        );
        if (isErr(downloadResult)) {
            return downloadResult;
        }
    }
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
    const unarchiveResult = await untar(archiveFile, toolDir);

    return unarchiveResult;
}

function downloadSource(): Errorable<string> {
    const osId = os();
    const archId = arch();

    if (osId === null || archId === null) {
        return err("Unsupported operating system or processor architecture");
    }

    const url = SPIN_DONWLOAD_URL_TEMPLATE.replace("{{subst:os}}", osId).replace("{{subst:arch}}", archId);
    return ok(url);
}

export function installLocation(tool: string, bin: string): string {
    // The ideal is to cache in extension storage (ExtensionContext::globalStorage)
    // but exec can only run from a plain ol' file path, so file path it is.
    const basePath = layout.toolsFolder();
    const toolPath = path.join(basePath, tool, `v${SPIN_VERSION}`);
    const binSuffix = process.platform === 'win32' ? '.exe' : '';
    const toolFile = path.join(toolPath, bin + binSuffix);
    return toolFile;
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

type DownloadFunc =
    (url: string, destination?: string, options?: unknown)
         => Promise<Buffer> & stream.Duplex; // Stream has additional events - see https://www.npmjs.com/package/download

let downloadImpl: DownloadFunc | undefined;

function ensureDownloadFunc() {
    if (!downloadImpl) {
        // Fix download module corrupting HOME environment variable on Windows
        // See https://github.com/Azure/vscode-kubernetes-tools/pull/302#issuecomment-404678781
        // and https://github.com/kevva/npm-conf/issues/13
        const home = process.env['HOME'];
        downloadImpl = require('download');
        if (home) {
            process.env['HOME'] = home;
        }
    }
}

function download(url: string, destinationFile: string): Promise<Buffer> & stream.Duplex {
    ensureDownloadFunc();
    if (downloadImpl) {
        return downloadImpl(url, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
    } else {
        throw new Error("Failed to initialise downloader");
    }
}

async function downloadTo(sourceUrl: string, destinationFile: string): Promise<Errorable<null>> {
    ensureDownloadFunc();
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
