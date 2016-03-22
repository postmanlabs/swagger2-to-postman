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

    it('should obey the includeQueryParams option', function () {
        var options = {
                includeQueryParams: false
            },
            samplePath = path.join(__dirname, 'data', 'sampleswagger.json'),
            swagger = require(samplePath),
            converterWithOptions = new Swagger2Postman(options),
            convertWithOptionsResult = converterWithOptions.convert(swagger),
            converterWithoutOptions = new Swagger2Postman(),
            convertWithoutOptionsResult = converterWithoutOptions.convert(swagger);
        expect(convertWithOptionsResult.collection.requests[3].url.indexOf('{') == -1);
        expect(convertWithoutOptionsResult.collection.requests[3].url.indexOf('{') > 0);
    });

    it('should obey the tagFilter option', function () {
        var options = {
                tagFilter: 'FOO'
            },
            validoptions = {
                tagFilter: 'SampleTag'
            },
            samplePath = path.join(__dirname, 'data', 'swagger2.json'),
            swagger = require(samplePath),
            converterWithOptions = new Swagger2Postman(options),
            convertWithOptionsResult = converterWithOptions.convert(swagger),
            converterWithValidOptions = new Swagger2Postman(validoptions),
            convertWithValidOptionsResult = converterWithValidOptions.convert(swagger),
            converterWithoutOptions = new Swagger2Postman(),
            convertWithoutOptionsResult = converterWithoutOptions.convert(swagger);
        expect(convertWithOptionsResult.collection.requests.length === 0);
        expect(convertWithValidOptionsResult.collection.requests.length > 0);
        expect(convertWithoutOptionsResult.collection.requests.length > 0);
    });
});
