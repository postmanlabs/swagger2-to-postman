var Swagger2Postman = require('../convert.js');
var swaggerSample = require('./sampleswagger.json');

var converter = new Swagger2Postman();
var collection = converter.convert(swaggerSample);

if(!collection.hasOwnProperty("id")) {
	console.error("No ID field in collection");
	process.exit(1);
}

process.exit(0);


