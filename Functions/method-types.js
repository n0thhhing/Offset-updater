

import fs from 'fs/promises';

async function findMethodType(DUMP_PATH, offset) {
    try {
        const dumpContent = await fs.readFile(DUMP_PATH, 'utf-8');

        const regex = /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+(.*?)\(/g;

        let match;
        while ((match = regex.exec(dumpContent)) !== null) {
            const currentOffset = parseInt(match[1], 16);
            const methodType = match[2].trim();

            if (currentOffset === offset) {
                const basicTypeMatch = methodType.match(/\b(int|bool|float|void|long)\b/);
                return basicTypeMatch ? basicTypeMatch[0] : null;
            }
        }
        return null;
    } catch (error) {
        console.error('Error reading the file:', error);
        return null;
    }
}

export { findMethodType }