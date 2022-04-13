// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require('../package.json');

/**
 * The _model_module_version/_view_module_version this package implements.
 *
 * The html widget manager assumes that this is the same as the npm package
 * version number.
 *
 * See counterparts in the _version.py file
 * These should not be changed unless we introduce changes to communication between
 * frontend and backend.
 */
export const MODEL_VERSION = '1.0.0';

/*
 * The current package name.
 */
export const MODULE_NAME = data.name;

/*
 * The package version
 */
export const MODULE_VERSION = data.version;
