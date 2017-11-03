var jupyter_matplotlib = require('./index');

var jupyter_widgets = require('@jupyter-widgets/base');

module.exports = {
    id: 'matplotlib-jupyter:main',
    requires: [jupyterlab_widgets.IJupyterWidgetRegistry],
    activate: function(app, widgets) {
        widgets.registerWidget({
            name: 'jupyter-matplotlib',
            version: jupyter_matplotlib.version,
            exports: jupyter_matplotlib
        });
    },
    autoStart: true
};
