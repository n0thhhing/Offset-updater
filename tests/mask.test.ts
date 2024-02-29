function decompSig(signature: string): { pattern: string; mask: string } {
    const bytes = signature.split(' ');
    let pattern = '';
    let mask = '';

    for (const byte of bytes) {
        if (byte === '??') {
            pattern += '\\x00';
            mask += '?';
        } else {
            pattern += `\\x${byte}`;
            mask += 'x';
        }
    }

    return { pattern, mask };
}

function compMask(pattern: string, mask: string): string {
    const patternBytes = pattern.match(/\\x[0-9a-fA-F]{2}/g) || [];
    const maskChars = mask.split('');
    let signature = '';

    for (let i = 0; i < patternBytes.length; i++) {
        if (maskChars[i] === 'x') {
            signature += patternBytes[i].slice(2).toUpperCase() + ' ';
        } else {
            signature += '?? ';
        }
    }

    return signature.trim();
}

// Example usage:
const signature =
    'A1 ?? ?? ?? ?? C3 CC CC CC CC CC CC CC CC CC CC A1 ?? ?? ?? ?? B9';
const { pattern, mask } = decompSig(signature);
console.log('Pattern returned:', pattern);
console.log('Mask returned:', mask);

const newSignature = compMask(pattern, mask);
console.log('Signature pattern:', newSignature);
