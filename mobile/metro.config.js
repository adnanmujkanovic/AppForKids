// Metro config: lets the app import the models shared with the server and web app (../shared).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(projectRoot, "../shared")];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
module.exports = config;
