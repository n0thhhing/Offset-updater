
import { parentPort, workerData } from "worker_threads"
function findClosestMatch(oldMemorySlice, newLibraryData) {
  const oldBuffer = Buffer.from(oldMemorySlice, 'base64');
  let minDistance = Infinity;
  let closestMatch = null;

  for (let i = 0; i < newLibraryData.length - oldBuffer.length + 1; i++) {
    const newSlice = newLibraryData.slice(i, i + oldBuffer.length);
    const distance = oldBuffer.compare(newSlice);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = newSlice;
    }
  }

  return closestMatch;
}

const { oldOffsets, oldLibraryData, newLibraryData } = workerData;

const results = [];

oldOffsets.forEach((offset) => {
  try {
    const oldMemorySlice = Buffer.from(oldLibraryData, 'base64').slice(offset, offset + 100); // Adjust the size as needed
    const closestMatch = findClosestMatch(oldMemorySlice, Buffer.from(newLibraryData, 'base64'));

    if (closestMatch) {
      const newOffset = Buffer.from(newLibraryData, 'base64').indexOf(closestMatch);
      parentPort.postMessage({
        type: 'result',
        data: {
          oldOffset: offset,
          closestMatch: closestMatch.toString('hex'),
          newOffset: newOffset,
        },
      });
      console.log(`Found offset: 0x${offset.toString(16)} in the new library.`);
    } else {
      console.log(`Could not find a match for offset: 0x${offset.toString(16)}`);
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'log',
      data: `Error finding offset: 0x${offset.toString(16)} - ${error.message}`,
    });
  }
});

process.exit(0);
