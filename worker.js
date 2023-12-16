import { parentPort, workerData } from 'worker_threads';

const { oldOffsets, oldLibraryData, newLibraryData, CHUNK_SIZE } = workerData;
const results = [];

oldOffsets.forEach((offset) => {
  try {
    const oldMemorySlice = Buffer.from(oldLibraryData, 'hex').slice(offset, offset + CHUNK_SIZE); // Adjust the size as needed
    const closestMatch = findClosestMatch(Buffer.from(newLibraryData, 'hex'), oldMemorySlice);

    if (closestMatch) {
      const newOffset = Buffer.from(newLibraryData, 'hex').indexOf(closestMatch);
      results.push({
        oldOffset: offset,
        closestMatch: closestMatch.toString('hex'),
        newOffset: newOffset,
      });
      console.log(`Found offset: 0x${offset.toString(16)} in the new library.`);
    } else {
      console.log(`Could not find a match for offset: 0x${offset.toString(16)}`);
    }
  } catch (error) {
    console.error(`Error finding offset: 0x${offset.toString(16)} - ${error.message}`);
  }
});

parentPort.postMessage(results);
