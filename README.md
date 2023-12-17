# Offset Finder

This script is designed to find offsets in a new library based on a set of offsets and a pattern from an old library. The algorithm optimizes the search process by skipping unnecessary iterations, resulting in improved performance.

## Prerequisites

- Node.js (v14 or later)

## Installation

Clone the repository:

```bash
git clone https://github.com/n0thhhing/Offset-updater.git
cd Offset-updater
```

Install dependencies:

```bash
npm i
npm i -g prettier uglify-js
```

## Usage

1. Prepare your offset file (`offsets.txt`) with a list of hexadecimal offsets, each on its own line.
2. Place your old library (`old.so`) and new library (`new.so`) in the `libs` folder.
3. Run the script:

```bash
npm start
```

The script will output the found offsets and relevant information in the `dist/output.txt` file.

## Configuration

Adjust the following parameters in the script as needed:

- `JUDSN`: If you dont know what this is, set to false
- `OFFSET_FILE`: Path to the offset file (`offsets.txt`).
- `OLD_LIBRARY_PATH`: Path to the old library (`libs/old.so`).
- `NEW_LIBRARY_PATH`: Path to the new library (`libs/new.so`).
- `OUTPUT_FILE`: Output file for results (`dist/output.txt`).
- `MEMORY_SLICE_SIZE`: Size of the memory slice for offset comparison (adjust as needed).
- `OLD_MEMORY_SLICE`: If you would like a more accurate result, set higher(this will make it slower)
- `0FFSET_PADDING`: This does not matter

## Performance

The script provides CPU usage and elapsed time information for performance evaluation. Ensure to check the script output for these metrics.

## Notes

- The script assumes that the first character of the hex pattern to find is the same in both libraries. there is a separate file(backup/test.js) that doesnt assume the first character is the same, but note this drastically slows everything down(40 seconds per offset)
- Adjust the memory slice size based on your specific requirements.

Feel free to clone or reach out for issues or improvements
