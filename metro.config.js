const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Su Windows Metro può andare in EMFILE (too many open files) con la
// FileStore della cache + tanti worker. Limita i worker e evita cache su disco.
config.maxWorkers = 4;
config.cacheStores = [];

module.exports = config;
