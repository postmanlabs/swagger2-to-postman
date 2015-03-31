# swagger20Postman
Converter for swagger 2.0 JSON to Postman v2

convert.js provides a jsFace class - Swagger2Postman. Check test/tescrscript.js for basic usage.

Initialise class:

    var swaggerConverter = new Swagger2Postman();

Optionally, set a logger:

    swaggerConverter.setLogger(console.log);

Convert your Swagger 2.0 JSON:

    var convertResult = swaggerConverter.convert(swaggerJson);

Check the result:

    convertResult.status === "failed" 
for unsuccessful conversions. Check convertResult.message

    convertResult.status === "passed"
for successful conversions. Check convertResult.collection for the Postman collection JSON

