var expect = require('expect.js'),
    Swagger2Postman = require('../convert.js'),
    fs = require('fs'),
    path = require('path');

/* global describe, it */
describe('the converter', function () {
    var samples = fs.readdirSync(path.join(__dirname, 'data'));

    samples.map(function (sample) {
        var samplePath = path.join(__dirname, 'data', sample);
        it('must convert ' + samplePath + ' to a postman collection', function () {
            var swagger = require(samplePath),
                converter = new Swagger2Postman(),
                convertResult = converter.convert(swagger);

            expect(convertResult.status).to.be('passed');
        });
    });

    it('must read values from the "x-postman-meta" key', function () {
        var samplePath = path.join(__dirname, 'data', 'swagger_aws.json'),
            swagger = require(samplePath),
            converter = new Swagger2Postman(),
            convertResult = converter.convert(swagger);
        // Make sure that currentHelper and helperAttributes are processed
        expect(convertResult.collection.requests[0]).to.have.key('currentHelper');
        expect(convertResult.collection.requests[0]).to.have.key('helperAttributes');
    });
});
