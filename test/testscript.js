var Swagger2Postman = require('../convert.js');
var swagger1 = require('./sampleswagger.json');
var swagger2 = require('./swagger2.json');
var fs = require('fs');

var converter = new Swagger2Postman();
//converter.setLogger(console.log);
var convertResult = converter.convert(swagger1);;

if(!convertResult) {
	console.error("Converter returned null");
	return;
}

if(!convertResult.status==="passed") {
	console.error("Conversion failed - " + convertResult.message);
	return;
}
else {
	fs.writeFile('collection1.json', JSON.stringify(convertResult.collection), function (err) {
	  if (err) return console.log(err);
	});
}




converter = new Swagger2Postman();
convertResult = converter.convert(swagger2);

if(!convertResult.status==="passed") {
	console.error("Conversion failed - " + convertResult.message);
	return;
}
else {
	fs.writeFile('collection2.json', JSON.stringify(convertResult.collection), function (err) {
	  if (err) return console.log(err);
	});
}

