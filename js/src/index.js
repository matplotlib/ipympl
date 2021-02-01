// Export widget models and views, and the npm package version number.
export * from './toolbar_widget.js';
export * from './mpl_widget.js';
import pkg from '../package.json';
export const { version } = pkg;
