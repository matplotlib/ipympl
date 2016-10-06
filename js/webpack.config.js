var version = require('./package.json').version;


// Build JupyterLab extension
var buildExtension = require('jupyterlab-extension-builder/lib/builder').buildExtension;
buildExtension({
  name: 'ipympl',
  entry: './src/labplugin',
  outputDir: '../ipympl/staticlab',
});



// Custom webpack loaders are generally the same for all webpack bundles, hence
// stored in a separate local variable.
var loaders = [
    { test: /\.json$/, loader: 'json-loader' },
];


module.exports = [
    {// Notebook extension
     //
     // This bundle only contains the part of the JavaScript that is run on
     // load of the notebook. This section generally only performs
     // some configuration for requirejs, and provides the legacy
     // "load_ipython_extension" function which is required for any notebook
     // extension.
     //
        entry: './src/extension.js',
        output: {
            filename: 'extension.js',
            path: '../ipympl/static',
            libraryTarget: 'amd'
        }
    },
    {// Bundle for the notebook containing the custom widget views and models
     //
     // This bundle contains the implementation for the custom widget views and
     // models.
     //
        entry: './src/index.js',
        output: {
            filename: 'index.js',
            path: '../ipympl/static',
            libraryTarget: 'amd'
        },
        devtool: 'source-map',
        module: {
            loaders: loaders
        },
        externals: ['jupyter-js-widgets']
    },
    {// Embeddable jupyter-matplotlib bundle
     //
     // This bundle is generally almost identical to the notebook bundle
     // containing the custom widget views and models.
     //
     // The only difference is in the configuration of the webpack public path
     // for the static assets.
     //
     // It will be automatically distributed by npmcdn to work with the static
     // widget embedder.
     //
     // The target bundle is always `dist/index.js`, which is the path required
     // by the custom widget embedder.
     //
        entry: './src/embed.js',
        output: {
            filename: 'index.js',
            path: './dist/',
            libraryTarget: 'amd',
            publicPath: 'https://npmcdn.com/jupyter-matplotlib@' + version + '/dist/'
        },
        devtool: 'source-map',
        module: {
            loaders: loaders
        },
        externals: ['jupyter-js-widgets']
    }
];
