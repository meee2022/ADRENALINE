// Metro: يرى مجلد القواعد المشتركة وواجهة Convex المولّدة خارج مجلد التطبيق
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..", "..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders || []),
  path.join(repoRoot, "shared"),
  path.join(repoRoot, "convex", "_generated"),
];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(repoRoot, "node_modules"),
];
module.exports = config;
