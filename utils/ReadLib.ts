import fs from 'fs';
async function readLib(filePath: string): Promise<Buffer | null> {
    try {
        const fileBuffer = await fs.promises.readFile(filePath);
        return fileBuffer;
    } catch (error: any) {
        console.log('error reading file', error);
        return null;
    }
}

export { readLib };
