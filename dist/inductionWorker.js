"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const index_1 = require("./index");
try {
    const input = worker_threads_1.workerData;
    const result = (0, index_1.runInduction)(input);
    worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ result });
}
catch (error) {
    worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
