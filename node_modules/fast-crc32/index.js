'use strict';

const stream = require('stream');
const crc    = require('sse4_crc32');

/**
 * Calculate CRC32 for the data in the provided stream
 *
 * @param {stream.Readable} _stream
 * @returns {Promise.<Number>}
 */
function calculateFromStream (_stream) {
    if (!(_stream instanceof stream.Readable))
        return Promise.reject(new TypeError('Stream must be an instance of Readable'));

    return new Promise(function (resolve, reject) {
        const crc32 = new crc.CRC32();

        _stream.on('data', chunk => crc32.update(chunk));
        _stream.once('end', () => resolve(crc32.crc()));
        _stream.once('error', reject);
    });
}

module.exports = { calculateFromStream, calculate: crc.calculate };
