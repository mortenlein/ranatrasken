// The map style and destination dataset live in the web app's source tree
// (../src) and are imported here via relative paths. Metro only bundles files
// it watches, so widen the watch scope to the repo root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  // proj4 (used by the shared coordinate helpers) resolves from the repo root
  path.join(repoRoot, 'node_modules'),
];

module.exports = config;
