var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');
var mpl = require('./mpl.js');

var version = require('../package.json').version;

var MPLCanvasModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.WidgetModel.prototype.defaults(), {
            _model_name: 'MPLCanvasModel',
            _view_name: 'MPLCanvasView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^'+ version,
            _view_module_version: '^' + version
        });
    }
});

var MPLCanvasView = widgets.DOMWidgetView.extend({
    render: function() {
        var fig = new mpl.figure(this.model.get('_id'), this, this.model.get('_toolbar_items'));

        this.send(JSON.stringify({ type: 'initialized' }));
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView
}
