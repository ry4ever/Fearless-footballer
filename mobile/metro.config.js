const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const projectRoot = path.resolve(__dirname, "..");

config.watchFolders = Array.from(
  new Set([projectRoot, ...(config.watchFolders ?? [])]),
);
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    path.resolve(__dirname, "node_modules"),
    path.resolve(projectRoot, "node_modules"),
    ...(config.resolver.nodeModulesPaths ?? []),
  ]),
);

module.exports = config;
