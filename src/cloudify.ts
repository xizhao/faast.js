import Axios from "axios";
import { createHash } from "crypto";
import debug from "debug";
import * as fs from "fs";
import humanStringify from "human-stringify";
import { Readable } from "stream";
import { FunctionCall, FunctionReturn, packer } from "./functionserver";
import { CloudFunctions, cloudfunctions_v1 as gcf, initializeGoogleAPIs } from "./google";

let log = debug("cloudify");

let cloudFunctionsApi: CloudFunctions | undefined;
let trampoline!: string;
let sha256!: string;

export interface CloudOptions {
    region?: string;
    zipFile?: string;
    description?: string;
    entryPoint?: string;
    timeout?: number;
    availableMemoryMb?: number;
    labels?: { [key: string]: string };
}

function getSha256(data: string): string {
    const hasher = createHash("sha256");
    hasher.update(JSON.stringify(data));
    return hasher.digest("hex");
}

/**
 * @param labels The labels applied to a resource must meet the following
 * requirements:
 *
 * Each resource can have multiple labels, up to a maximum of 64. Each label
 * must be a key-value pair. Keys have a minimum length of 1 character and a
 * maximum length of 63 characters, and cannot be empty. Values can be empty,
 * and have a maximum length of 63 characters. Keys and values can contain only
 * lowercase letters, numeric characters, underscores, and dashes. All
 * characters must use UTF-8 encoding, and international characters are allowed.
 * The key portion of a label must be unique. However, you can use the same key
 * with multiple resources. Keys must start with a lowercase letter or
 * international character. For a given reporting service and project, the
 * number of distinct key-value pair combinations that will be preserved within
 * a one-hour window is 1,000. For example, the Compute Engine service reports
 * metrics on virtual machine (VM) instances. If you deploy a project with 2,000
 * VMs, each with a distinct label, the service reports metrics are preserved
 * for only the first 1,000 labels that exist within the one-hour window.
 */
function validateLabels(labels: object) {
    const keys = Object.keys(labels);
    if (keys.length > 64) {
        throw new Error("Cannot exceeded 64 labels");
    }
    if (keys.find(key => typeof key !== "string" || typeof labels[key] !== "string")) {
        throw new Error(`Label keys and values must be strings`);
    }
    if (keys.find(key => key.length > 63 || labels[key].length > 63)) {
        throw new Error(`Label keys and values cannot exceed 63 characters`);
    }
    if (keys.find(key => key.length === 0)) {
        throw new Error(`Label keys must have length > 0`);
    }
    const pattern = /^[a-z0-9_-]*$/;
    if (keys.find(key => !key.match(pattern) || !labels[key].match(pattern))) {
        throw new Error(
            `Label keys and values can contain only lowercase letters, numeric characters, underscores, and dashes.`
        );
    }
}

export async function initCloudify(
    serverModule: string,
    {
        region = "us-central1",
        description = "cloudify trampoline function",
        entryPoint = "trampoline",
        timeout = 60,
        availableMemoryMb = 256,
        labels = {}
    }: CloudOptions = {}
) {
    if (cloudFunctionsApi) {
        return;
    }

    const serverFile = require.resolve(serverModule);
    const { archive, hash: codeHash } = await packer(serverFile);
    log(`hash: ${codeHash}`);

    const google = await initializeGoogleAPIs();
    const project = await google.auth.getDefaultProjectId();
    cloudFunctionsApi = new CloudFunctions(google, project);

    log(`Create cloud function`);

    const codehasha = codeHash.slice(0, 32);
    const codehashb = codeHash.slice(32);
    const locationPath = cloudFunctionsApi.locationPath(region);
    const uploadUrlResponse = await cloudFunctionsApi.generateUploaddUrl(locationPath);
    const uploadResult = await uploadZip(uploadUrlResponse.uploadUrl!, archive);
    log(`Upload zip file response: ${uploadResult.statusText}`);

    let functionRequest: gcf.Schema$CloudFunction = {
        description,
        entryPoint,
        timeout: `${timeout}s`,
        availableMemoryMb,
        httpsTrigger: {},
        sourceUploadUrl: uploadUrlResponse.uploadUrl,
        labels: {
            ...labels,
            codehasha,
            codehashb,
            nonce: `${Math.random()}`.replace(".", "")
        }
    };

    validateLabels(functionRequest.labels);

    const configHash = getSha256(JSON.stringify(functionRequest));

    trampoline = cloudFunctionsApi.functionPath(
        region,
        "cloudify-" + configHash.slice(0, 35)
    );
    functionRequest.name = trampoline;

    await checkExistingTrampolineFunction();

    log(`Create function at ${locationPath}`);
    log(humanStringify(functionRequest));
    try {
        await cloudFunctionsApi.createFunction(locationPath, functionRequest);
    } catch (err) {
        log(`Error: ${err.stack}`);
        await cleanupCloudify();
        throw err;
    }
}

async function checkExistingTrampolineFunction() {
    // It should be rare to get a trampoline collision because we include
    // part of the sha256 hash as part of the name, but we check just in
    // case.
    const existingFunc = await cloudFunctionsApi!
        .getFunction(trampoline)
        .catch(_ => undefined);
    if (existingFunc) {
        throw new Error(`Trampoline hash collision`);
    }
}

async function uploadZip(url: string, zipStream: Readable) {
    return await Axios.put(url, zipStream, {
        headers: {
            "content-type": "application/zip",
            "x-goog-content-length-range": "0,104857600"
        }
    });
}

export async function cleanupCloudify() {
    if (!cloudFunctionsApi) {
        return;
    }

    await cloudFunctionsApi.deleteFunction(trampoline).catch(_ => {});
}

// prettier-ignore
export function cloudify<T0, R>(fn: (a0: T0) => Promise<R>): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, R>( fn: (a0: T0, a1: T1) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, R>( fn: (a0: T0, a1: T1, a2: T2) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, R>( fn: (a0: T0, a1: T1, a2: T2, a3: T3) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, R>( fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, R>( fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, R>( fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, T7, R>( fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, T7, T8, R>( fn: ( a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7, a8: T8 ) => Promise<R> ): typeof fn;
// prettier-ignore
export function cloudify<T0, R>(fn: (a0: T0) => R): (arg: T0) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, R>(fn: (a0: T0, a1: T1) => R): (a0: T0, a1: T1) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, R>(fn: (a0: T0, a1: T1, a2: T2) => R): (a0: T0, a1: T1, a2: T2) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3) => R): (a0: T0, a1: T1, a2: T2, a3: T3) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4) => R): (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5) => R): (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6) => R): (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, T7, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7) => R): (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7) => Promise<R>;
// prettier-ignore
export function cloudify<T0, T1, T2, T3, T4, T5, T6, T7, T8, R>(fn: (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7, a8: T8) => R): (a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6, a7: T7, a8: T8) => Promise<R>;

/**
 *
 * @param {(...args: any[]) => R} fn Parameters can be any value that can be JSON.stringify'd
 * @returns {(...args: any[]) => Promise<R>} A return value that can be JSON.stringify'd
 * @memberof CloudFactory
 */
export function cloudify<R>(fn: (...args: any[]) => R): (...args: any[]) => Promise<R> {
    return async (...args: any[]) => {
        let callArgs: FunctionCall = {
            name: fn.name,
            args
        };
        const callArgsStr = JSON.stringify(callArgs);
        log(`Calling cloud function "${fn.name}" with args: ${callArgsStr}`, "");
        const response = await cloudFunctionsApi!.callFunction(trampoline, callArgsStr);

        if (response.error) {
            throw new Error(response.error);
        }
        log(`  returned: ${response.result}`);
        let returned: FunctionReturn = JSON.parse(response.result!);
        if (returned.type === "error") {
            throw new Error(returned.message);
        }
        return returned.value as R;
    };
}

async function testPacker(serverModule: string) {
    const output = fs.createWriteStream("dist.zip");

    const serverFile = require.resolve(serverModule);
    const { archive, hash } = await packer(serverFile);
    archive.pipe(output);
    log(`hash: ${hash}`);
}

if (process.argv.length > 2 && process.argv[2] === "--test") {
    testPacker("./server");
}
