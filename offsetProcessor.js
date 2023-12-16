
import { parentPort, workerData } from "worker_threads"
const { offsets, oldLibraryData, newLibraryData } = workerData;

(async () => {
  const limit = pLimit(5);
  const results = await Promise.all(
    offsets.map(async offset => limit(async () => processOffset(offset, oldLibraryData, newLibraryData, [])))
  );

  parentPort.postMessage(results);
})();
