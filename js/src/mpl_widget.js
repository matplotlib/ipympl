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
        var that = this;
        var id = this.model.get('_id');
        var element = this.$el;

        this.ws_proxy = this.comm_websocket_adapter(this.model.comm);

        function ondownload(figure, format) {
           var save = document.createElement('a');
           save.href = figure.image.src;
           save.download = figure.header.textContent + '.png';
           document.body.appendChild(save);
           save.click();
           document.body.removeChild(save);
        }

        mpl.toolbar_items = this.model.get('_toolbar_items')

        var fig = new mpl.figure(id, this.ws_proxy,
                                 ondownload,
                                 element.get(0));

        // Call onopen now - mpl needs it, as it is assuming we've passed it a real
        // web socket which is closed, not our websocket->open comm proxy.
        this.ws_proxy.onopen();

        fig.parent_element = element.get(0);

        // subscribe to incoming messages from the MPLCanvasWidget
        this.model.on('msg:custom', this.ws_proxy.onmessage, this);

        this.send(JSON.stringify({ type: 'initialized' }));
    },

    comm_websocket_adapter: function(comm) {
        // Create a "websocket"-like object which calls the given comm
        // object with the appropriate methods. Currently this is a non binary
        // socket, so there is still some room for performance tuning.
        var ws = {};
        var that = this;

        ws.close = function() {
            comm.close()
        };
        ws.send = function(m) {
            that.send(m);
        };
        return ws;
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView
}
