var uuid = require('node-uuid'),
    jsface = require('jsface'),
    url = require('url'),

    ConvertResult = function (status, message) {
        this.status = status;
        this.message = message;
    },

    Swagger2Postman = jsface.Class({
        constructor: function () {
            this.collectionJson = {
                'id': '',
                'name': '',
                'description': '',
                'order': [],
                'folders': [],
                'timestamp': 1413302258635,
                'synced': false,
                'requests': []
            };
            this.basePath = '';
            this.collectionId = '';
            this.folders = {};
            this.baseParams = {};
            this.logger = function () {
            };
        },

        setLogger: function (func) {
            this.logger = func;
        },

        validate: function (json) {
            if (!json.hasOwnProperty('swagger') || json.swagger !== '2.0') {
                return new ConvertResult('failed', 'Must contain a swagger field (2.0)');
            }

            if (!json.hasOwnProperty('info')) {
                return new ConvertResult('failed', 'Must contain an info object');
            }
            else {
                var info = json.info;
                if (!info.title) {
                    return new ConvertResult('failed', 'Must contain info.title');
                }
            }

            return new ConvertResult('passed', '');
        },

        setBasePath: function (json) {
            this.basePath = '';
            if (json.host) {
                this.basePath = json.host;
            }
            if (json.basePath) {
                this.basePath += json.basePath;
            }

            if (json.schemes && json.schemes.indexOf('https') != -1) {
                this.basePath = 'https://' + this.basePath;
            }
            else {
                this.basePath = 'http://' + this.basePath;
            }
        },

        getFolderNameForPath: function (pathUrl) {
            var segments = pathUrl.split('/'),
                numSegments = segments.length,
                folderName = null;
            this.logger('Getting folder name for path: ' + pathUrl);
            this.logger('Segments: ' + JSON.stringify(segments));
            if (numSegments > 1) {
                folderName = segments[1];

                // create a folder for this path url
                if (!this.folders[folderName]) {
                    this.folders[folderName] = this.createNewFolder(folderName);
                }
                this.logger('For path ' + pathUrl + ', returning folderName ' + this.folders[folderName].name);
                return this.folders[folderName].name;
            }
            else {
                this.logger('Error - path MUST begin with /');
                return null;
            }
        },

        createNewFolder: function (name) {
            var newFolder = {
                'id': uuid.v4(),
                'name': name,
                'description': 'Folder for ' + name,
                'order': [],
                'collection_name': this.collectionJson.name,
                'collection_id': this.collectionId,
                'collection': this.collectionId
            };
            this.logger('Created folder ' + newFolder.name);
            return newFolder;
        },

        handleInfo: function (json) {
            this.collectionJson.name = json.info.title;
            this.collectionJson.description = json.info.description;
        },

        getParamsForPathItem: function (oldParams, newParams) {
            var retVal = {},
                numOldParams,
                numNewParams,
                i,
                parts,
                lastPart,
                getBaseParam;

            oldParams = oldParams || [];
            newParams = newParams || [];

            numOldParams = oldParams.length;
            numNewParams = newParams.length;

            for (i = 0; i < numOldParams; i++) {
                if (oldParams[i].$ref) {
                    // this is a ref
                    if (oldParams[i].$ref.indexOf('#/parameters') === 0) {
                        parts = oldParams[i].$ref.split('/');
                        lastPart = parts[parts.length - 1];
                        getBaseParam = this.baseParams[lastPart];
                        retVal[lastPart] = getBaseParam;
                    }
                }
                else {
                    retVal[oldParams[i].name] = oldParams[i];
                }
            }

            for (i = 0; i < numNewParams; i++) {
                if (newParams[i].$ref) {
                    // this is a ref
                    if (newParams[i].$ref.indexOf('#/parameters') === 0) {
                        parts = newParams[i].$ref.split('/');
                        lastPart = parts[parts.length - 1];
                        getBaseParam = this.baseParams[lastPart];
                        retVal[lastPart] = getBaseParam;
                    }
                }
                else {
                    retVal[newParams[i].name] = newParams[i];
                }
            }

            return retVal;
        },

        addOperationToFolder: function (path, method, operation, folderName, params) {
            var root = this,
                request = {
                    'id': uuid.v4(),
                    'headers': '',
                    'url': '',
                    'pathVariables': {},
                    'preRequestScript': '',
                    'method': 'GET',
                    'data': [
                        {
                            'key': 'size',
                            'value': 'original',
                            'type': 'text',
                            'enabled': true
                        }
                    ],
                    'dataMode': 'params',
                    'description': operation.description || '',
                    'descriptionFormat': 'html',
                    'time': '',
                    'version': 2,
                    'responses': [],
                    'tests': '',
                    'collectionId': root.collectionId,
                    'synced': false
                },
                thisParams = this.getParamsForPathItem(params, operation.parameters),
                hasQueryParams = false,
                param,
                requestAttr;

            request.url = decodeURI(url.resolve(this.basePath, path));
            request.method = method;
            request.name = operation.summary;
            request.time = (new Date()).getTime();

            // Handle custom swagger attributes for postman aws integration
            if (operation['x-postman-integration']) {
                for (requestAttr in operation['x-postman-integration']) {
                    if (operation['x-postman-integration'].hasOwnProperty(requestAttr)) {
                        request[requestAttr] = operation['x-postman-integration'][requestAttr];
                    }
                }
            }

            // set data and headers
            for (param in thisParams) {
                if (thisParams.hasOwnProperty(param) && thisParams[param]) {
                    this.logger('Processing param: ' + JSON.stringify(param));
                    if (thisParams[param].in === 'query') {
                        if (!hasQueryParams) {
                            hasQueryParams = true;
                            request.url += '?';
                        }
                        request.url += thisParams[param].name + '={{' + thisParams[param].name + '}}&';
                    }

                    else if (thisParams[param].in === 'header') {
                        request.headers += thisParams[param].name + ': {{' + thisParams[param].name + '}}\n';
                    }

                    else if (thisParams[param].in === 'body') {
                        request.dataMode = 'raw';
                        request.data = thisParams[param].description;
                    }

                    else if (thisParams[param].in === 'form') {
                        request.dataMode = 'params';
                        request.data.push({
                            'key': thisParams[param].name,
                            'value': '{{' + thisParams[param].name + '}}',
                            'type': 'text',
                            'enabled': true
                        });
                    } // (thisParams[param].in === 'path') case not handled
                }
            }

            this.collectionJson.requests.push(request);
            this.folders[folderName].order.push(request.id);
        },

        addPathItemToFolder: function (path, pathItem, folderName) {
            if (pathItem.$ref) {
                this.logger('Error - cannot handle $ref attributes');
                return;
            }

            var paramsForPathItem = this.getParamsForPathItem(this.baseParams, pathItem.parameters);

            // replace path variables {petId} with {{..}}
            if (path) {
                path = path.replace('{', '{{').replace('}', '}}');
            }

            if (pathItem.get) {
                this.addOperationToFolder(path, 'GET', pathItem.get, folderName, paramsForPathItem);
            }
            if (pathItem.put) {
                this.addOperationToFolder(path, 'PUT', pathItem.put, folderName, paramsForPathItem);
            }
            if (pathItem.post) {
                this.addOperationToFolder(path, 'POST', pathItem.post, folderName, paramsForPathItem);
            }
            if (pathItem.delete) {
                this.addOperationToFolder(path, 'DELETE', pathItem.delete, folderName, paramsForPathItem);
            }
            if (pathItem.options) {
                this.addOperationToFolder(path, 'OPTIONS', pathItem.options, folderName, paramsForPathItem);
            }
            if (pathItem.head) {
                this.addOperationToFolder(path, 'HEAD', pathItem.head, folderName, paramsForPathItem);
            }
            if (pathItem.path) {
                this.addOperationToFolder(path, 'PATH', pathItem.path, folderName, paramsForPathItem);
            }
        },

        handlePaths: function (json) {
            var paths = json.paths,
                path,
                folderName;

            // Add a folder for each path
            for (path in paths) {
                if (paths.hasOwnProperty(path)) {
                    folderName = this.getFolderNameForPath(path);
                    if (!folderName) {
                        continue;
                    }
                    this.logger('Adding path item. path = ' + path + '   folder = ' + folderName);
                    this.addPathItemToFolder(path, paths[path], folderName);
                }
            }
        },

        handleParams: function (params, level) {
            if (!params) {
                return;
            }
            if (level === 'collection') {
                // base params
                for (var param in params) {
                    if (params.hasOwnProperty(param)) {
                        this.logger('Adding collection param: ' + param);
                        this.baseParams[param] = params[param];
                    }
                }
            }
        },

        addFoldersToCollection: function () {
            var folderName;
            for (folderName in this.folders) {
                if (this.folders.hasOwnProperty(folderName)) {
                    this.collectionJson.folders.push(this.folders[folderName]);
                }
            }
        },

        convert: function (json) {
            var validationResult = this.validate(json);
            if (validationResult.status === 'failed') {
                // error
                return validationResult;
            }

            this.collectionId = uuid.v4();

            this.handleParams(json.parameters, 'collection');

            this.handleInfo(json);

            this.setBasePath(json);

            this.handlePaths(json);

            this.addFoldersToCollection();

            this.collectionJson.id = this.collectionId;
            // this.logger(JSON.stringify(this.collectionJson));
            this.logger('Swagger converted successfully');

            validationResult.collection = this.collectionJson;

            return validationResult;
        }
    });

module.exports = Swagger2Postman;
