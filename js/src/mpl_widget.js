var widgets = require('jupyter-js-widgets');
var mpl = require('./mpl.js');
var _ = require('underscore');
var $ = require('jquery');
require('jquery-ui');

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
            window.open(figure.imageObj.src);
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

mpl.figure.prototype.handle_close = function(fig, msg) {
    var width = fig.canvas.width/mpl.ratio
    fig.root.unbind('remove')

    fig.close_ws(fig, msg);
}

mpl.figure.prototype.close_ws = function(fig, msg){
    fig.send_message('closing', msg);
    // fig.ws.close()
}

mpl.figure.prototype.updated_canvas_event = function() {
    // Tell Jupyter that the notebook contents must change.
    Jupyter.notebook.set_dirty(true);
    this.send_message("ack", {});
}

mpl.figure.prototype._init_toolbar = function() {
    var fig = this;

    var nav_element = $('<div/>')
    nav_element.attr('style', 'width: 100%');
    this.root.append(nav_element);

    // Define a callback function for later on.
    function toolbar_event(event) {
        return fig.toolbar_button_onclick(event['data']);
    }
    function toolbar_mouse_event(event) {
        return fig.toolbar_button_onmouseover(event['data']);
    }

    for(var toolbar_ind in mpl.toolbar_items) {
        var name = mpl.toolbar_items[toolbar_ind][0];
        var tooltip = mpl.toolbar_items[toolbar_ind][1];
        var image = mpl.toolbar_items[toolbar_ind][2];
        var method_name = mpl.toolbar_items[toolbar_ind][3];

        if (!name) { continue; };

        var button = $('<button class="btn btn-default" href="#" title="' + name + '"><i class="fa ' + image + ' fa-lg"></i></button>');
        button.click(method_name, toolbar_event);
        button.mouseover(tooltip, toolbar_mouse_event);
        nav_element.append(button);
    }

    // Add the status bar.
    var status_bar = $('<span class="mpl-message" style="text-align:right; float: right;"/>');
    nav_element.append(status_bar);
    this.message = status_bar[0];

    // Add the close button to the window.
    var buttongrp = $('<div class="btn-group inline pull-right"></div>');
    var button = $('<button class="btn btn-mini btn-primary" href="#" title="Stop Interaction"><i class="fa fa-power-off icon-remove icon-large"></i></button>');
    button.click(function (evt) { fig.handle_close(fig, {}); } );
    button.mouseover('Stop Interaction', toolbar_mouse_event);
    buttongrp.append(button);
    var titlebar = this.root.find('.ui-dialog-titlebar'));
    titlebar.prepend(buttongrp);
}

mpl.figure.prototype._root_extra_style = function(el) {
    var fig = this
    el.on("remove", function(){
        fig.close_ws(fig, {});
    });
}

mpl.figure.prototype._canvas_extra_style = function(el) {
    // this is important to make the div 'focusable'
    el.attr('tabindex', 0)
}

mpl.figure.prototype._key_event_extra = function(event, name) {
}

mpl.figure.prototype.handle_save = function(fig, msg) {
    fig.ondownload(fig, null);
}

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView
}
