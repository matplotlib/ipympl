var jupyter_matplotlib = require('./index');

var jupyterlab_widgets = require('@jupyter-widgets/jupyterlab-manager');

module.exports = {
    id: 'matplotlib-jupyter:main',
    requires: [jupyterlab_widgets.INBWidgetExtension],
    activate: function(app, widgets) {
        widgets.registerWidget({
            name: 'jupyter-matplotlib',
            version: jupyter_matplotlib.version,
            exports: jupyter_matplotlib
        });
    },
    autoStart: true
};
