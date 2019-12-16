var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');
var toolbar = require('./toolbar_widget.js');
var utils = require('./utils.js');

require('./mpl_widget.css');

var version = require('../package.json').version;

var MPLCanvasModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_name: 'MPLCanvasModel',
            _view_name: 'MPLCanvasView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^'+ version,
            _view_module_version: '^' + version,
            toolbar: null,
            toolbar_visible: true,
            toolbar_position: 'horizontal'
        });
    }
}, {
    serializers: _.extend({
        toolbar: { deserialize: widgets.unpack_models }
    }, widgets.DOMWidgetModel.serializers)
});

var MPLCanvasView = widgets.DOMWidgetView.extend({
    render: function() {
        this.canvas = undefined;
        this.context = undefined;
        this.rubberband_canvas = undefined;
        this.rubberband_context = undefined;

        this.image_mode = 'full';

        this.figure = document.createElement('div');
        this.figure.addEventListener('remove', this.close.bind(this));
        this.figure.classList = 'jupyter-matplotlib-figure jupyter-widgets widget-container widget-box widget-vbox';

        this._init_header();
        this._init_canvas();
        this._init_image();
        this._init_footer();

        this.waiting = false;

        var that = this;

        return this.create_child_view(this.model.get('toolbar')).then(function(toolbar_view) {
            that.toolbar_view = toolbar_view;

            that.update_toolbar_position();

            that.model_events();

            that.send_initialization_message();
        });
    },

    model_events: function() {
        this.model.on('msg:custom', this.on_comm_message.bind(this));
        this.model.on('change:toolbar_visible', this.update_toolbar_visible.bind(this));
        this.model.on('change:toolbar_position', this.update_toolbar_position.bind(this));
    },

    send_initialization_message: function() {
        if (this.ratio != 1) {
            this.send_message('set_dpi_ratio', {'dpi_ratio': this.ratio});
        }
        this.send_message('send_image_mode');
        this.send_message('refresh');

        this.send_message('initialized');
    },

    update_toolbar_visible: function() {
        this.toolbar_view.el.style.display = this.model.get('toolbar_visible') ? '' : 'none';
        this.request_resize();
    },

    update_toolbar_position: function() {
        var toolbar_position = this.model.get('toolbar_position');
        if (toolbar_position == 'top' || toolbar_position == 'bottom') {
            this.el.classList = 'jupyter-widgets widget-container widget-box widget-vbox jupyter-matplotlib';
            this.model.get('toolbar').set('orientation', 'horizontal');

            this.clear();

            if (toolbar_position == 'top') {
                this.el.appendChild(this.toolbar_view.el);
                this.el.appendChild(this.figure);
            } else {
                this.el.appendChild(this.figure);
                this.el.appendChild(this.toolbar_view.el);
            }
        } else {
            this.el.classList = 'jupyter-widgets widget-container widget-box widget-hbox jupyter-matplotlib';
            this.model.get('toolbar').set('orientation', 'vertical');

            this.clear();

            if (toolbar_position == 'left') {
                this.el.appendChild(this.toolbar_view.el);
                this.el.appendChild(this.figure);
            } else {
                this.el.appendChild(this.figure);
                this.el.appendChild(this.toolbar_view.el);
            }
        }

        this.request_resize();
    },

    clear: function() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
    },

    _init_header: function() {
        this.header = document.createElement('div');
        this.header.style.textAlign = 'center';
        this.header.style.flexGrow = 0;
        this.header.style.flexShrink = 0;
        this.header.classList = 'jupyter-widgets widget-label';
        this.figure.appendChild(this.header);
    },

    _init_canvas: function() {
        var canvas_div = this.canvas_div = document.createElement('div');
        canvas_div.style.position = 'relative';
        canvas_div.style.clear = 'both';
        canvas_div.classList = 'jupyter-widgets jupyter-matplotlib-canvas_div';

        canvas_div.addEventListener('keydown', this.key_event('key_press'));
        canvas_div.addEventListener('keyup', this.key_event('key_release'));

        // this is important to make the div 'focusable'
        canvas_div.setAttribute('tabindex', 0);
        this.figure.appendChild(canvas_div);

        var canvas = this.canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.left = 0;
        canvas.style.top = 0;
        canvas.style.zIndex = 0;

        this.context = canvas.getContext('2d');

        var backingStore = this.context.backingStorePixelRatio ||
            this.context.webkitBackingStorePixelRatio ||
            this.context.mozBackingStorePixelRatio ||
            this.context.msBackingStorePixelRatio ||
            this.context.oBackingStorePixelRatio ||
            this.context.backingStorePixelRatio || 1;

        this.ratio = (window.devicePixelRatio || 1) / backingStore;

        var rubberband_canvas = this.rubberband_canvas = document.createElement('canvas');
        rubberband_canvas.style.display = 'block';
        rubberband_canvas.style.position = 'absolute';
        rubberband_canvas.style.left = 0;
        rubberband_canvas.style.top = 0;
        rubberband_canvas.style.zIndex = 1;

        rubberband_canvas.addEventListener('mousedown', this.mouse_event('button_press'));
        rubberband_canvas.addEventListener('mouseup', this.mouse_event('button_release'));
        rubberband_canvas.addEventListener('mousemove', this.mouse_event('motion_notify'));

        rubberband_canvas.addEventListener('mouseenter', this.mouse_event('figure_enter'));
        rubberband_canvas.addEventListener('mouseleave', this.mouse_event('figure_leave'));

        rubberband_canvas.addEventListener('wheel', this.mouse_event('scroll'));

        canvas_div.appendChild(canvas);
        canvas_div.appendChild(rubberband_canvas);

        this.rubberband_context = rubberband_canvas.getContext('2d');
        this.rubberband_context.strokeStyle = '#000000';

        // Disable right mouse context menu.
        this.rubberband_canvas.addEventListener('contextmenu', function(e) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
    },

    _init_image: function() {
        var that = this;
        this.image = document.createElement('img');
        this.image.style.display = 'none';

        this.figure.appendChild(this.image);
        this.image.onload = function() {
            if (that.image_mode == 'full') {
                // Full images could contain transparency (where diff images
                // almost always do), so we need to clear the canvas so that
                // there is no ghosting.
                that.context.clearRect(0, 0, that.canvas.width, that.canvas.height);
            }
            that.context.drawImage(that.image, 0, 0);
        };

        this.image.onunload = function() {
            that.close();
        }
    },

    _init_footer: function() {
        this.footer = document.createElement('div');
        this.footer.style.textAlign = 'center';
        this.header.style.flexGrow = 0;
        this.header.style.flexShrink = 0;
        this.footer.classList = 'jupyter-widgets widget-label';
        this.figure.appendChild(this.footer);
    },

    _calculate_decorations_size: function() {
        // Calculate the size of the decorations on the figure.
        var decorations_width = 0;
        var decorations_height = 0;

        // Toolbar size
        var toolbar_position = this.model.get('toolbar_position');
        if (toolbar_position == 'top' || toolbar_position == 'bottom') {
            decorations_height += utils.get_full_size(this.toolbar_view.el).height;
        } else {
            decorations_width += utils.get_full_size(this.toolbar_view.el).width;
        }

        // Label sizes
        decorations_height += utils.get_full_size(this.header).height;
        decorations_height += utils.get_full_size(this.footer).height;

        // Margins on the canvas
        var canvas_div_margins = utils.get_margin_size(this.canvas_div);
        decorations_width += canvas_div_margins.width;
        decorations_height += canvas_div_margins.height;

        // Margins on the figure div
        var figure_margins = utils.get_margin_size(this.figure);
        decorations_width += figure_margins.width;
        decorations_height += figure_margins.height;

        return {
            width: decorations_width,
            height: decorations_height
        };
    },

    request_resize: function() {
        // Ensure that the image already exists. We ignore the first calls to resize
        // because we want the widget to first adapt to the figure size set in
        // matplotlib.
        if (!this.image.src) {
            return;
        }

        // Using the given widget size, figure out how big the canvas should be.
        var decorations_size = this._calculate_decorations_size();

        var new_canvas_width = this.el.clientWidth - decorations_size.width;
        var new_canvas_height = this.el.clientHeight - decorations_size.height;

        // Ensure that the canvas size is a positive number.
        new_canvas_width = new_canvas_width < 1 ? 1 : new_canvas_width;
        new_canvas_height = new_canvas_height < 1 ? 1 : new_canvas_height;

        this.send_message('resize', {'width': new_canvas_width, 'height': new_canvas_height});
    },

    _resize_canvas: function(width, height) {
        // Keep the size of the canvas, and rubber band canvas in sync.
        this.canvas.setAttribute('width', width * this.ratio);
        this.canvas.setAttribute('height', height * this.ratio);
        this.canvas.style.width = width + 'px';

        this.rubberband_canvas.setAttribute('width', width);
        this.rubberband_canvas.setAttribute('height', height);

        this.canvas_div.style.width = width + 'px';
        this.canvas_div.style.height = height + 'px';

        // Figure out the widget size.
        var decorations_size = this._calculate_decorations_size();

        // Reset the widget size to adapt to this figure.
        this.el.style.width = width + decorations_size.width + 'px';
        this.el.style.height = height + decorations_size.height + 'px';
    },

    send_message: function(type, message = {}) {
        message['type'] = type;

        this.send(message);
    },

    send_draw_message: function() {
        if (!this.waiting) {
            this.waiting = true;
            this.send_message('draw');
        }
    },

    handle_save: function() {
        var save = document.createElement('a');
        save.href = this.canvas.toDataURL();
        save.download = this.header.textContent + '.png';
        document.body.appendChild(save);
        save.click();
        document.body.removeChild(save);
    },

    handle_resize: function(msg) {
        var size = msg['size'];
        if (size[0] != this.canvas.width || size[1] != this.canvas.height) {
            this._resize_canvas(size[0], size[1]);
            this.send_message('refresh');
        };
    },

    handle_rubberband: function(msg) {
        var x0 = msg['x0'] / this.ratio;
        var y0 = (this.canvas.height - msg['y0']) / this.ratio;
        var x1 = msg['x1'] / this.ratio;
        var y1 = (this.canvas.height - msg['y1']) / this.ratio;
        x0 = Math.floor(x0) + 0.5;
        y0 = Math.floor(y0) + 0.5;
        x1 = Math.floor(x1) + 0.5;
        y1 = Math.floor(y1) + 0.5;
        var min_x = Math.min(x0, x1);
        var min_y = Math.min(y0, y1);
        var width = Math.abs(x1 - x0);
        var height = Math.abs(y1 - y0);

        this.rubberband_context.clearRect(
            0, 0, this.canvas.width, this.canvas.height);

        this.rubberband_context.strokeRect(min_x, min_y, width, height);
    },

    handle_figure_label: function(msg) {
        // Updates the figure title.
        this.header.textContent = msg['label'];
    },

    handle_message: function(msg) {
        this.footer.textContent = msg['message'];
    },

    handle_cursor: function(msg) {
        var cursor = msg['cursor'];
        switch(cursor)
        {
        case 0:
            cursor = 'pointer';
            break;
        case 1:
            cursor = 'default';
            break;
        case 2:
            cursor = 'crosshair';
            break;
        case 3:
            cursor = 'move';
            break;
        }
        this.rubberband_canvas.style.cursor = cursor;
    },

    handle_draw: function(msg) {
        // Request the server to send over a new figure.
        this.send_draw_message();
    },

    handle_binary: function(msg, dataviews) {
        var url_creator = window.URL || window.webkitURL;

        var buffer = new Uint8Array(dataviews[0].buffer);
        var blob = new Blob([buffer], {type: 'image/png'});
        var image_url = url_creator.createObjectURL(blob);

        // Free the memory for the previous frames
        if (this.image.src) {
            url_creator.revokeObjectURL(this.image.src);
        }

        this.image.src = image_url;

        // Tell Jupyter that the notebook contents must change.
        this.send_message('ack');

        this.waiting = false;
    },

    handle_image_mode: function(msg) {
        this.image_mode = msg['mode'];
    },

    on_comm_message: function(evt, dataviews) {
        var msg = JSON.parse(evt.data);
        var msg_type = msg['type'];

        // Call the  'handle_{type}' callback, which takes
        // the figure and JSON message as its only arguments.
        try {
            var callback = this['handle_' + msg_type].bind(this);
        } catch (e) {
            console.log('No handler for the \'' + msg_type + '\' message type: ', msg);
            return;
        }

        if (callback) {
            try {
                callback(msg, dataviews);
            } catch (e) {
                console.log('Exception inside the \'handler_' + msg_type + '\' callback:', e, e.stack, msg);
            }
        }
    },

    processPhosphorMessage: function(msg) {
        MPLCanvasView.__super__.processPhosphorMessage.apply(this, arguments);

        switch (msg.type) {
        case 'resize':
            this.request_resize();
            break;
        }
    },


    mouse_event: function(name) {
        var that = this;
        var last_update = 0;
        return function(event) {
            var canvas_pos = utils.get_mouse_position(event);

            if (name === 'scroll') {
                event['data'] = 'scroll'
                if (event.deltaY < 0) {
                    event.step = 1;
                } else {
                    event.step = -1;
                }
            }

            if (name === 'button_press') {
                that.canvas.focus();
                that.canvas_div.focus();
            }

            // Rate-limit the position text updates so that we don't overwhelm the
            // system.
            if (Date.now() > last_update + 16) {
                last_update = Date.now();

                var x = canvas_pos.x * that.ratio;
                var y = canvas_pos.y * that.ratio;

                that.send_message(name, {x: x, y: y, button: event.button,
                                        step: event.step,
                                        guiEvent: utils.get_simple_keys(event)});
            }

            /* This prevents the web browser from automatically changing to
             * the text insertion cursor when the button is pressed.  We want
             * to control all of the cursor setting manually through the
             * 'cursor' event from matplotlib */
            event.preventDefault();
            return false;
        };
    },

    key_event: function(name) {
        var that = this;
        return function(event) {
            event.stopPropagation();
            event.preventDefault();

            // Prevent repeat events
            if (name == 'key_press') {
                if (event.which === that._key)
                    return;
                else
                    that._key = event.which;
            }
            if (name == 'key_release') {
                that._key = null;
            }

            var value = '';
            if (event.ctrlKey && event.which != 17)
                value += 'ctrl+';
            if (event.altKey && event.which != 18)
                value += 'alt+';
            if (event.shiftKey && event.which != 16)
                value += 'shift+';

            value += 'k';
            value += event.which.toString();

            that.send_message(name, {key: value, guiEvent: utils.get_simple_keys(event)});
            return false;
        };
    },

    close: function(){
        this.send_message('closing');
        this.trigger('close');
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView,
    ToolbarModel: toolbar.ToolbarModel,
    ToolbarView: toolbar.ToolbarView
}
