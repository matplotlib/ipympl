var mpl_widget = require('./mpl_widget');

var jupyterlab_widgets = require('jupyterlab_widgets/lib/plugin');
var version = require('../package.json').version;

/**
 * The widget manager provider.
 */
module.exports = {
  id: 'jupyter.extensions.matplotlib',
  requires: [jupyterlab_widgets.IIPyWidgetExtension],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter-matplotlib',
          version: version,
          exports: mpl_widget
      });
    },
  autoStart: true
};
