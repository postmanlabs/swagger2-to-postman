#!/usr/bin/env bash

set -e;

echo "jscs v`jscs --version`";
jscs ./convert.js test/;

echo;

jshint --version;
jshint ./convert.js test/;
echo "No code lint issues found.";

echo
echo "Running unit tests..."
echo "mocha v`mocha --version`";

mocha test/*-spec.js;
