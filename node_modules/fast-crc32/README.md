# fast-crc32 [![Build status](https://travis-ci.org/v12/fast-crc32.svg?branch=master)](https://travis-ci.org/v12/fast-crc32) [![npm version](https://img.shields.io/npm/v/fast-crc32.svg)](https://www.npmjs.com/package/fast-crc32) [![Dependency Status](https://david-dm.org/v12/fast-crc32.svg)](https://david-dm.org/v12/fast-crc32)

## Installation
```sh
npm install fast-crc32 --save
```

## Usage
```javascript
const crc32 = require('fast-crc32'),
      http  = require('http');

http.get('http://example.com',
    response => crc32.calculateFromStream(response)
        .then(checksum => console.log('CRC32C: ' + checksum.toString(16)))
        .catch(error => console.error('Unable to calculate CRC32C', error)));
```
