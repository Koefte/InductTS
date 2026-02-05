import { parentPort, workerData } from 'worker_threads';
import { runInduction, InductionInput } from './index';

try {
    const input = workerData as InductionInput;
    const result = runInduction(input);
    parentPort?.postMessage({ result });
} catch (error) {
    parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
