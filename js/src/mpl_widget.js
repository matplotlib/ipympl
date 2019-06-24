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
        var id = this.model.get('_id');
        var toolbar_items = this.model.get('_toolbar_items');

        this.fig = new mpl.figure(id, toolbar_items, this);

        this.el.appendChild(this.fig.root);
    },

    processPhosphorMessage: function(msg) {
        MPLCanvasView.__super__.processPhosphorMessage.apply(this, arguments);
        switch (msg.type) {
        case 'resize':
            var rect = this.el.getBoundingClientRect();
            this.fig.request_resize(rect.width, rect.height);
            break;
        }
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView
}
