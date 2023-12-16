/* eslint-env mocha */

'use strict';

const chai = require('chai');

chai.use(require('chai-as-promised'));

const expect = chai.expect;

describe('fast-crc32c', function () {
    const crc32 = require('..');

    it('should provide CRC32C calculation methods', function () {
        expect(crc32).to.have.keys('calculate', 'calculateFromStream');
    });

    describe('promise', function () {
        describe('~calculateFromStream', function () {
            const calc = crc32.calculateFromStream;

            it('should be resolved for a given stream', function () {
                return expect(calc(require('fs').createReadStream(__dirname + '/test.txt')))
                    .to.be.eventually.equal(0x12369401);
            });

            it('should be rejected when not readable stream provided', function () {
                return Promise.all([
                    expect(calc(require('stream').Writable())).to.be.eventually.rejectedWith(TypeError),
                    expect(calc(null)).to.be.eventually.rejectedWith(TypeError)
                ]);
            });
        });

        describe('~calculate', function () {
            const calc = crc32.calculate;

            it('should return checksum for a given string', function () {
                return expect(calc('123123\n')).to.be.equal(0x12369401);
            });
            it('should return checksum for a given Buffer', function () {
                return expect(calc(new Buffer([ 0x31, 0x32, 0x33, 0x31, 0x32, 0x33, 0x0a ]))).to.be.equal(0x12369401);
            });
        });
    });
});
