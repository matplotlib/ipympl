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
            _view_module_version: '^' + version,
            _toolbar_items: [],
            _id: '',
            _data: null
        });
    }
});

var MPLCanvasView = widgets.DOMWidgetView.extend({
    render: function() {
        this.fig = new mpl.figure(this.model.get('_id'), this, this.model.get('_toolbar_items'));

        this.send(JSON.stringify({ type: 'initialized' }));

        this.model_events();
    },

    model_events: function() {
        var that = this;
        this.model.on('change:_data', function(evt) {
            var url_creator = window.URL || window.webkitURL;

            // that.fig.update_canvas()
            var buffer = new Uint8Array(that.model.get('_data').buffer);
            var blob = new Blob([buffer], {type: "image/png"});
            var image_url = url_creator.createObjectURL(blob);

            // Free the memory for the previous frames
            if (that.fig.image.src) {
                url_creator.revokeObjectURL(that.fig.image.src);
            }

            that.fig.image.src = image_url;
            that.fig.updated_canvas_event();
            that.fig.waiting = false;
        })
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView
}
