var _ = require('lodash');
var uuid = require('node-uuid');

function ConvertResult(status, message) {
	this.status = status;
	this.message = message;
}

var converter = {
	basePath: "",
	collectionId: "",
	folders: {} ,
	baseParams: {},

	collectionJson: {
		"id": "",
		"name": "",
		"description": "",
		"order": [
		],
		"folders": [],
		"timestamp": 1413302258635,
		"synced": false,
		"requests": [
		]
	},

	validate: function(json) {
		if(!json.hasOwnProperty("swagger") || json.swagger!=="2.0") {
			return new ConvertResult("failed", "Must contain a swagger field (2.0)");
		}

		if(!json.hasOwnProperty("info")) {
			return new ConvertResult("failed", "Must contain an info object");	
		}
		else { 
			var info = json.info;
			if(!info.title) {
				return new ConvertResult("failed", "Must contain info.title");
			}
		}

		return new ConvertResult("passed","");
	},

	setBasePath: function(json) {
		this.basePath = "";
		if(json.host) {
			this.basePath = json.host;
		}
		if(json.basePath) {
			this.basePath += json.basePath;
		}

		if(json.schemas && json.schemas.indexOf("https")!=-1) {
			this.basePath = "https://" + this.basePath;
		}
		else {
			this.basePath = "http://" + this.basePath;
		}
	},

	getFolderNameForPath: function(pathUrl) {
		var segments = pathUrl.split("/");
		var numSegments = segments.length;
		var folderName = null;
		console.log("Getting folder name for path: " + pathUrl);
		console.log("Segments: " + JSON.stringify(segments));
		if(numSegments>1) {
			folderName = segments[1];

			//create a folder for this path url
			if(!this.folders[folderName]) {
				this.folders[folderName] = this.createNewFolder(folderName);
			}
			console.log("For path " + pathUrl + ", returning folderName " + this.folders[folderName].name);
			return this.folders[folderName].name;
		}
		else {
			console.log("Error - path MUST begin with /");
			return null;
		}
	},

	createNewFolder: function(name) {
		var newFolder = {
			"id": uuid.v4(),
			"name": name,
			"description": "Folder for " + name,
			"order": [],
			"collection_name": this.collectionJson.name,
			"collection_id": this.collectionId,
			"collection": this.collectionId,
		};
		console.log("Created folder " + newFolder.name);
		return newFolder;
	},

	handleInfo: function(json) {
		this.collectionJson.name = json.info.title;
		this.collectionJson.description = json.info.description;
	},

	getParamsForPathItem: function(oldParams, newParams) {
		if(!oldParams) oldParams = [];
		if(!newParams) newParams = [];

		var root = this;
		var retVal = {};
		var numOldParams = oldParams.length;
		var numNewParams = newParams.length;

		for(var i=0;i<numOldParams;i++) {
			if(oldParams[i]["$ref"]) {
				//this is a ref
				if(oldParams[i]["$ref"].indexOf("#/parameters") == 0) {
					var parts = oldParams[i]["$ref"].split("/");
					var lastPart = parts[parts.length-1];
					var getBaseParam = this.baseParams[lastPart];
					retVal[lastPart] = getBaseParam;
				}
			}
			else {	
				retVal[oldParams[i].name] = oldParams[i];
			}
		}

		for(var i=0;i<numNewParams;i++) {
			if(newParams[i]["$ref"]) {
				//this is a ref
				if(newParams[i]["$ref"].indexOf("#/parameters") == 0) {
					var parts = newParams[i]["$ref"].split("/");
					var lastPart = parts[parts.length-1];
					var getBaseParam = this.baseParams[lastPart];
					retVal[lastPart] = getBaseParam;
				}
			}
			else {	
				retVal[newParams[i].name] = newParams[i];
			}
		}

		return retVal;
	},

	addOperationToFolder: function(path, method, operation, folderName, params) {
		var root = this;
		var request = {
				"id": uuid.v4(),
				"headers": "",
				"url": "",
				"pathVariables": {},
				"preRequestScript": "",
				"method": "GET",
				"data": [
					{
						"key": "size",
						"value": "original",
						"type": "text",
						"enabled": true
					}
				],
				"dataMode": "params",
				"description": "",
				"descriptionFormat": "html",
				"time": "",
				"version": 2,
				"responses": [],
				"tests": "",
				"collectionId": root.collectionId,
				"synced": false
			};

		request.description = operation.description;

		var thisParams = this.getParamsForPathItem(params, operation.parameters);
		request.url = this.basePath + path;
		request.method = method;
		request.name = operation.summary;
		request.time = (new Date()).getTime();

		var hasQueryParams = false;

		//set data and headers
		for(param in thisParams) {
			if(thisParams.hasOwnProperty(param)) {
				console.log("Processing param: " + JSON.stringify(param));
				if(thisParams[param].in === "query") {
					if(!hasQueryParams) {
						hasQueryParams = true;
						request.url += "?";
					}
					request.url += thisParams[param].name + "={{" + thisParams[param].name + "}}&";
				}

				else if(thisParams[param].in==="header") {
					request.headers += thisParams[param].name + ": {{" + thisParams[param].name + "}}\n";
				}

				else if(thisParams[param].in==="path") {
					//meh
				}

				else if(thisParams[param].in==="formData") {
					request.dataMode = "params";
					request.data.push({
						"key": thisParams[param].name,
						"value": "{{" + thisParams[param].name + "}}",
						"type": "text",
						"enabled": true
					});
				}
			}
		}

		this.collectionJson.requests.push(request);
		this.folders[folderName].order.push(request.id);
	},

	addPathItemToFolder: function(path, pathItem, folderName) {
		if(pathItem["$ref"]) {
			console.log("Error - cannot handle $ref attributes");
			return;
		}

		var paramsForPathItem = this.getParamsForPathItem(this.baseParams, pathItem.parameters);

		if(pathItem.get) this.addOperationToFolder(path, "GET", pathItem.get, folderName, paramsForPathItem);
		if(pathItem.put) this.addOperationToFolder(path, "PUT", pathItem.put, folderName, paramsForPathItem);
		if(pathItem.post) this.addOperationToFolder(path, "POST", pathItem.post, folderName, paramsForPathItem);
		if(pathItem.delete) this.addOperationToFolder(path, "DELETE", pathItem.delete, folderName, paramsForPathItem);
		if(pathItem.options) this.addOperationToFolder(path, "OPTIONS", pathItem.options, folderName, paramsForPathItem);
		if(pathItem.head) this.addOperationToFolder(path, "HEAD", pathItem.head, folderName, paramsForPathItem);
		if(pathItem.path) this.addOperationToFolder(path, "PATH", pathItem.path, folderName, paramsForPathItem);
	},

	handlePaths: function(json) {
		var paths = json.paths;

		//Add a folder for each path
		for(var path in paths){
		  if (paths.hasOwnProperty(path)) { 
		    var folderName = this.getFolderNameForPath(path);
		    if(!folderName) {
		    	continue;
		    }
		    console.log("Adding path item. path = " + path+"   folder = " + folderName);
		    this.addPathItemToFolder(path, paths[path], folderName);
		  }
		}
	},

	handleParams: function(params, level) {
		if(!params) return;
		if(level === "collection") {
			//base params
			for(var param in params) {
				if(params.hasOwnProperty(param)) {
					console.log("Adding collection param: " + param);
					this.basePath[param] = params[param];
				}
			}
			return;
		}
	},

	addFoldersToCollection: function() {
		for(folderName in this.folders) {
			if(this.folders.hasOwnProperty(folderName)) {
				this.collectionJson.folders.push(this.folders[folderName]);
			}
		}
	},

	convert: function(json) {
		var validationResult = this.validate(json);
		if(validationResult.status === "failed") {
			//error
			return;
		}

		this.collectionId = uuid.v4();

		this.handleParams(json.parameters, "collection")

		this.handleInfo(json);

		this.setBasePath(json);

		this.handlePaths(json);

		this.addFoldersToCollection();
	
		this.collectionJson.id = this.collectionId;
		console.log(JSON.stringify(this.collectionJson));
		
	},
};

module.exports = converter;