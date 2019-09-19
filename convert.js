var uuidv4 = require('uuid/v4'),
    jsface = require('jsface'),
    url = require('url'),
    META_KEY = 'x-postman-meta',

    ConvertResult = function (status, message) {
        this.status = status;
        this.message = message;
    },

    Swagger2Postman = jsface.Class({
        constructor: function (options) {
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
            // Base parameters are the reference-able collection parameters
            this.baseParams = {};
            // Resource parameters are shared to all operations under the resource
            this.resourceParams = {};
            this.logger = function () {
            };

            this.options = options || {};

            this.options.includeQueryParams = typeof (this.options.includeQueryParams) == 'undefined' ?
                true : this.options.includeQueryParams;
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
                if (!info || !info.title) {
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

            if (!this.endsWith(this.basePath, '/')) {
                this.basePath += '/';
            }
        },

        getFolderNameForPath: function (pathUrl) {
            if (pathUrl == '/') {
                return null;
            }
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
                'id': uuidv4(),
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

        getParamsForPathItem: function (params) {
            var retVal = {},
                numParams,
                i,
                parts,
                lastPart;

            // Ensure params are arrays of objects.
            // The param be single-level nested objects if they come from the retVal of this method!

            if (this.isObject(params)) {
                params = this.paramsObjectToArray(params);
            }

            params = params || [];
            numParams = params.length;

            for (i = 0; i < numParams; i++) {
                if (params[i].$ref) {
                    // this is a ref
                    if (params[i].$ref.indexOf('#/parameters') === 0) {
                        parts = params[i].$ref.split('/');
                        lastPart = parts[parts.length - 1];
                        retVal[lastPart] = this.baseParams[lastPart];
                    }
                }
                else {
                    retVal[params[i].name] = params[i];
                }
            }

            return retVal;
        },

        addOperationToFolder: function (path, method, operation, folderName) {
            var root = this,
                request = {
                    'id': uuidv4(),
                    'headers': '',
                    'url': '',
                    'pathVariables': {},
                    'preRequestScript': '',
                    'method': 'GET',
                    'data': [],
                    'rawModeData': null,
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
                thisParams = this.getParamsForPathItem(
                    this.mergeObjectArrays(this.resourceParams, operation.parameters)),
                hasQueryParams = false,
                param,
                requestAttr,
                defaultVal,
                thisConsumes = root.globalConsumes,
                thisProduces = root.globalProduces,
                tempBasePath;

            if (path.length > 0 && path[0] === '/') {
                path = path.substring(1);
            }

            // Problem here
            // url.resolve("http://host.com/", "/api") returns "http://host.com/api"
            // but url.resolve("http://{{host}}.com/", "/api") returns "http:///%7B..host.com/api"
            // (note the extra slash after http:)
            // request.url = decodeURI(url.resolve(this.basePath, path));
            tempBasePath = this.basePath
                .replace(/{{/g, 'POSTMAN_VARIABLE_OPEN_DB')
                .replace(/}}/g, 'POSTMAN_VARIABLE_CLOSE_DB');

            request.url = decodeURI(url.resolve(tempBasePath, path))
                .replace(/POSTMAN_VARIABLE_OPEN_DB/gi, '{{')
                .replace(/POSTMAN_VARIABLE_CLOSE_DB/gi, '}}');

            request.method = method;
            request.name = operation.summary;
            request.time = (new Date()).getTime();

            // Handle custom swagger attributes for postman aws integration
            if (operation[META_KEY]) {
                for (requestAttr in operation[META_KEY]) {
                    if (operation[META_KEY].hasOwnProperty(requestAttr)) {
                        request[requestAttr] = operation[META_KEY][requestAttr];
                    }
                }
            }

            if (operation.produces) {
                thisProduces = operation.produces;
            }

            if (operation.consumes) {
                thisConsumes = operation.consumes;
            }

            // set the default dataMode for this request, even if it doesn't have a body
            // eg. for GET requests
            if (thisConsumes.indexOf('application/x-www-form-urlencoded') > -1) {
                request.dataMode = 'urlencoded';
            }

            if (thisProduces.length > 0) {
                request.headers += 'Accept: ' + thisProduces.join(', ') + '\n';
            }
            if (thisConsumes.length > 0) {
                request.headers += 'Content-Type: ' + thisConsumes[0] + '\n';
            }

            // set data and headers
            for (param in thisParams) {
                if (thisParams.hasOwnProperty(param) && thisParams[param]) {
                    this.logger('Processing param: ' + JSON.stringify(param));

                    // Get default value for .in = query/header/path/formData
                    defaultVal = '{{' + thisParams[param].name + '}}';
                    if (thisParams[param].hasOwnProperty('default')) {
                        defaultVal = thisParams[param].default;
                    }

                    if (thisParams[param].in === 'query' && this.options.includeQueryParams !== false) {
                        if (!hasQueryParams) {
                            hasQueryParams = true;
                            request.url += '?';
                        }
                        request.url += thisParams[param].name + '=' + defaultVal + '&';
                    }

                    else if (thisParams[param].in === 'header') {
                        request.headers += thisParams[param].name + ': ' + defaultVal + '\n';
                    }

                    else if (thisParams[param].in === 'body') {
                        request.dataMode = 'raw';
                        request.rawModeData = thisParams[param].description;
                    }

                    else if (thisParams[param].in === 'formData') {
                        if (thisConsumes.indexOf('application/x-www-form-urlencoded') > -1) {
                            request.dataMode = 'urlencoded';
                        }
                        else {
                            request.dataMode = 'params';
                        }
                        request.data.push({
                            'key': thisParams[param].name,
                            'value': defaultVal,
                            'type': 'text',
                            'enabled': true
                        });
                    }
                    else if (thisParams[param].in === 'path') {
                        if (!request.hasOwnProperty('pathVariables')) {
                            request.pathVariables = {};
                        }
                        request.pathVariables[thisParams[param].name] = defaultVal;
                    }
                }
            }

            if (hasQueryParams && this.endsWith(request.url, '&')) {
                request.url = request.url.slice(0, -1);
            }

            this.collectionJson.requests.push(request);
            if (folderName !== null) {
                this.folders[folderName].order.push(request.id);
            }
            else {
                this.collectionJson.order.push(request.id);
            }
        },

        addPathItemToFolder: function (path, pathItem, folderName) {
            if (pathItem.$ref) {
                this.logger('Error - cannot handle $ref attributes');
                return;
            }

            var paramsForPathItem = this.getParamsForPathItem(
                this.mergeObjectArrays(pathItem.parameters, this.resourceParams)),
                acceptedPostmanVerbs = [
                    'get', 'put', 'post', 'patch', 'delete', 'copy', 'head', 'options',
                    'link', 'unlink', 'purge', 'lock', 'unlock', 'propfind', 'view'],
                numVerbs = acceptedPostmanVerbs.length,
                i,
                verb;

            // replace path variables {petId} with :petId
            if (path) {
                path = path.replace(/{/g, ':').replace(/}/g, '');
            }

            for (i = 0; i < numVerbs; i++) {
                verb = acceptedPostmanVerbs[i];
                if (pathItem[verb]) {
                    this.logger('Adding Operation to Folder: ' + verb.toUpperCase() + ' ' + path);

                    this.addOperationToFolder(
                        path,
                        verb.toUpperCase(),
                        pathItem[verb],
                        folderName,
                        paramsForPathItem
                    );
                }
            }
        },

        handlePaths: function (json) {
            var i,
                paths = json.paths,
                path,
                folderName;

            // Add a folder for each path
            for (path in paths) {
                if (paths.hasOwnProperty(path)) {
                    folderName = this.getFolderNameForPath(path);
                    this.logger('Adding path item. path = ' + path + ' folder = ' + folderName);

                    // Update a specific Operations parameters with any parent Resource parameters.
                    this.resourceParams = [];

                    if (path.startsWith('/')) {
                        if (paths[path].parameters) {
                            for (i = 0; i < paths[path].parameters.length; i++) {
                                this.resourceParams.push(paths[path].parameters[i]);
                            }
                        }
                        this.addPathItemToFolder(path, paths[path], folderName);
                    }
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

            this.collectionId = uuidv4();

            this.globalConsumes = json.consumes || [];

            this.globalProduces = json.produces || [];

            // Pull reference-able parameter definitions into memory
            this.handleParams(json.parameters, 'collection');

            this.handleInfo(json);

            this.setBasePath(json);

            this.handlePaths(json);

            this.addFoldersToCollection();

            this.collectionJson.id = this.collectionId;

            this.logger('Swagger converted successfully');

            validationResult.collection = this.collectionJson;

            return validationResult;
        },

        // since travis doesnt support es6
        endsWith: function (str, suffix) {
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        },

        /**
         * Converts a params collection object into an arrow of param objects.
         * @param {*} params
         */
        paramsObjectToArray: function (params) {
            var key,
                result = [];
            for (key in params) {
                if (params.hasOwnProperty(key)) {
                    result.push(params[key]);
                }
            }
            return result;
        },

        /**
         * Merge the 2 objects; with the first object taking precedence on key-conflicts.
         * @param {*} obj1 the assertive object.
         * @param {*} obj2 the deferring object.
         */
        mergeObjectArrays: function (obj1, obj2) {
            var i,
                result = [],
                tracker = [];

            obj1 = obj1 || [];
            obj2 = obj2 || [];

            for (i = 0; i < obj1.length; i++) {
                result.push(obj1[i]);
                tracker.push(obj1[i].name);
            }

            for (i = 0; i < obj2.length; i++) {
                if (tracker.indexOf(obj2[i].name) === -1) {
                    result.push(obj2[i]);
                }
            }

            return result;
        },

        /**
         * Checks if the parameter is a JavaScript object
         * @param {*} value
         */
        isObject: function (value) {
            return value && typeof value === 'object' && value.constructor === Object;
        }
    });

module.exports = Swagger2Postman;
