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
            header_visible: true,
            footer_visible: true,
            toolbar: null,
            toolbar_visible: true,
            toolbar_position: 'horizontal',
            _width: 0,
            _height: 0,
            _figure_label: 'Figure',
            _message: '',
            _cursor: 'pointer',
            _image_mode: 'full',
            _rubberband_x: 0,
            _rubberband_y: 0,
            _rubberband_width: 0,
            _rubberband_height: 0,
        });
    },

    initialize: function(attributes, options) {
        MPLCanvasModel.__super__.initialize.call(this, attributes, options);

        this.offscreen_canvas = document.createElement('canvas');
        this.offscreen_context = this.offscreen_canvas.getContext('2d');
        var backingStore = this.offscreen_context.backingStorePixelRatio ||
            this.offscreen_context.webkitBackingStorePixelRatio ||
            this.offscreen_context.mozBackingStorePixelRatio ||
            this.offscreen_context.msBackingStorePixelRatio ||
            this.offscreen_context.oBackingStorePixelRatio || 1;

        this.requested_size = null;
        this.resize_requested = false;
        this.ratio = (window.devicePixelRatio || 1) / backingStore;
        this._init_image();

        this.on('msg:custom', this.on_comm_message.bind(this));

        this.send_initialization_message();
    },

    send_message: function(type, message = {}) {
        message['type'] = type;

        this.send(message);
    },

    send_initialization_message: function() {
        if (this.ratio != 1) {
            this.send_message('set_dpi_ratio', {'dpi_ratio': this.ratio});
        }

        this.send_message('send_image_mode');
        this.send_message('refresh');

        this.send_message('initialized');
    },

    send_draw_message: function() {
        if (!this.waiting) {
            this.waiting = true;
            this.send_message('draw');
        }
    },

    handle_save: function() {
        var save = document.createElement('a');
        save.href = this.offscreen_canvas.toDataURL();
        save.download = this.get('_figure_label') + '.png';
        document.body.appendChild(save);
        save.click();
        document.body.removeChild(save);
    },

    handle_resize: function(msg) {
        var size = msg['size'];
        this.resize_canvas(size[0], size[1]);
        this.offscreen_context.drawImage(this.image, 0, 0);

        if (!this.resize_requested) {
            this._for_each_view(function(view) {
                view.resize_canvas(size[0], size[1]);
            });
        }

        this.send_message('refresh');

        this.resize_requested = false;
        if (this.requested_size !== null) {
            // Requesting saved resize
            this.resize(this.requested_size[0], this.requested_size[1]);
            this.requested_size = null;
        }
    },

    resize: function(width, height) {
        this._for_each_view(function(view) {
            // Do an initial resize of each view, stretching the old canvas.
            view.resize_canvas(width, height);
        });

        if (this.resize_requested) {
            // If a resize was already requested, save the requested size for later
            this.requested_size = [width, height];
        } else {
            this.resize_requested = true;
            this.send_message('resize', {'width': width, 'height': height});
        }
    },

    resize_canvas: function(width, height) {
        this.offscreen_canvas.setAttribute('width', width * this.ratio);
        this.offscreen_canvas.setAttribute('height', height * this.ratio);
    },

    handle_rubberband: function(msg) {
        var x0 = msg['x0'] / this.ratio;
        var y0 = (this.offscreen_canvas.height - msg['y0']) / this.ratio;
        var x1 = msg['x1'] / this.ratio;
        var y1 = (this.offscreen_canvas.height - msg['y1']) / this.ratio;
        x0 = Math.floor(x0) + 0.5;
        y0 = Math.floor(y0) + 0.5;
        x1 = Math.floor(x1) + 0.5;
        y1 = Math.floor(y1) + 0.5;

        this.set('_rubberband_x', Math.min(x0, x1));
        this.set('_rubberband_y', Math.min(y0, y1));
        this.set('_rubberband_width', Math.abs(x1 - x0));
        this.set('_rubberband_height', Math.abs(y1 - y0));
        this.save_changes();

        this._for_each_view(function(view) {
            view.update_canvas();
        });
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
            callback(msg, dataviews);
        }
    },

    _init_image: function() {
        var that = this;

        this.image = document.createElement('img');
        this.image.onload = function() {
            if (that.get('_image_mode') == 'full') {
                // Full images could contain transparency (where diff images
                // almost always do), so we need to clear the canvas so that
                // there is no ghosting.
                that.offscreen_context.clearRect(0, 0, that.offscreen_canvas.width, that.offscreen_canvas.height);
            }
            that.offscreen_context.drawImage(that.image, 0, 0);

            that._for_each_view(function(view) {
                view.update_canvas();
            });
        };
    },

    _for_each_view: function(callback) {
        for (const view_id in this.views) {
            this.views[view_id].then((view) => {
                callback(view);
            });
        }
    },

    remove: function() {
        this.send_message('closing');
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
        this.top_canvas = undefined;
        this.top_context = undefined;
        this.resizing = false;
        this.resize_handle_size = 20;

        this.figure = document.createElement('div');
        this.figure.classList = 'jupyter-matplotlib-figure jupyter-widgets widget-container widget-box widget-vbox';

        this._init_header();
        this._init_canvas();
        this._init_footer();

        this._resize_event = this.resize_event.bind(this);
        this._stop_resize_event = this.stop_resize_event.bind(this);
        window.addEventListener('mousemove', this._resize_event);
        window.addEventListener('mouseup', this._stop_resize_event);

        this.waiting = false;

        var that = this;

        return this.create_child_view(this.model.get('toolbar')).then(function(toolbar_view) {
            that.toolbar_view = toolbar_view;

            that._update_toolbar_position();

            that._update_header_visible();
            that._update_footer_visible();
            that._update_toolbar_visible();

            that.model_events();
        });
    },

    model_events: function() {
        this.model.on('change:header_visible', this._update_header_visible.bind(this));
        this.model.on('change:footer_visible', this._update_footer_visible.bind(this));
        this.model.on('change:toolbar_visible', this._update_toolbar_visible.bind(this));
        this.model.on('change:toolbar_position', this._update_toolbar_position.bind(this));
        this.model.on('change:_figure_label', this._update_figure_label.bind(this));
        this.model.on('change:_message', this._update_message.bind(this));
        this.model.on('change:_cursor', this._update_cursor.bind(this));
    },

    _update_header_visible: function() {
        this.header.style.display = this.model.get('header_visible') ? '': 'none';
    },

    _update_footer_visible: function() {
        this.footer.style.display = this.model.get('footer_visible') ? '': 'none';
    },

    _update_toolbar_visible: function() {
        this.toolbar_view.el.style.display = this.model.get('toolbar_visible') ? '' : 'none';
    },

    _update_toolbar_position: function() {
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
    },

    clear: function() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
    },

    _init_header: function() {
        this.header = document.createElement('div');
        this.header.style.textAlign = 'center';
        this.header.classList = 'jupyter-widgets widget-label';
        this._update_figure_label();
        this.figure.appendChild(this.header);
    },

    _update_figure_label: function(msg) {
        this.header.textContent = this.model.get('_figure_label');
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

        var top_canvas = this.top_canvas = document.createElement('canvas');
        top_canvas.style.display = 'block';
        top_canvas.style.position = 'absolute';
        top_canvas.style.left = 0;
        top_canvas.style.top = 0;
        top_canvas.style.zIndex = 1;

        top_canvas.addEventListener('mousedown', this.mouse_event('button_press'));
        top_canvas.addEventListener('mouseup', this.mouse_event('button_release'));
        top_canvas.addEventListener('mousemove', this.mouse_event('motion_notify'));

        top_canvas.addEventListener('mouseenter', this.mouse_event('figure_enter'));
        top_canvas.addEventListener('mouseleave', this.mouse_event('figure_leave'));

        top_canvas.addEventListener('wheel', this.mouse_event('scroll'));

        canvas_div.appendChild(canvas);
        canvas_div.appendChild(top_canvas);

        this.top_context = top_canvas.getContext('2d');
        this.top_context.strokeStyle = 'rgba(0, 0, 0, 255)';

        // Disable right mouse context menu.
        this.top_canvas.addEventListener('contextmenu', function(e) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        });

        this.resize_canvas(this.model.get('_width'), this.model.get('_height'));
        this.update_canvas();
    },

    update_canvas: function() {
        if (this.canvas.width == 0 || this.canvas.height == 0) {
            return;
        }

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.model.offscreen_canvas, 0, 0);

        this.top_context.clearRect(0, 0, this.top_canvas.width, this.top_canvas.height);

        // Draw rubberband
        if (this.model.get('_rubberband_width') != 0 && this.model.get('_rubberband_height') != 0) {
            this.top_context.strokeRect(
                this.model.get('_rubberband_x'), this.model.get('_rubberband_y'),
                this.model.get('_rubberband_width'), this.model.get('_rubberband_height')
            );
        }

        // Draw resize handle
        this.top_context.save();

        var gradient = this.top_context.createLinearGradient(
            this.top_canvas.width - this.resize_handle_size / 3, this.top_canvas.height - this.resize_handle_size / 3,
            this.top_canvas.width - this.resize_handle_size / 4, this.top_canvas.height - this.resize_handle_size / 4
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 255)');

        this.top_context.fillStyle = gradient;

        this.top_context.globalAlpha = 0.3;
        this.top_context.beginPath();
        this.top_context.moveTo(this.top_canvas.width, this.top_canvas.height);
        this.top_context.lineTo(this.top_canvas.width, this.top_canvas.height - this.resize_handle_size);
        this.top_context.lineTo(this.top_canvas.width - this.resize_handle_size, this.top_canvas.height);
        this.top_context.closePath();
        this.top_context.fill();

        this.top_context.restore();
    },

    _update_cursor: function() {
        this.top_canvas.style.cursor = this.model.get('_cursor');
    },

    _init_footer: function() {
        this.footer = document.createElement('div');
        this.footer.style.textAlign = 'center';
        this.footer.classList = 'jupyter-widgets widget-label';
        this._update_message();
        this.figure.appendChild(this.footer);
    },

    _update_message: function() {
        this.footer.textContent = this.model.get('_message');
    },

    resize_canvas: function(width, height) {
        // Keep the size of the canvas, and rubber band canvas in sync.
        this.canvas.setAttribute('width', width * this.model.ratio);
        this.canvas.setAttribute('height', height * this.model.ratio);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.top_canvas.setAttribute('width', width);
        this.top_canvas.setAttribute('height', height);

        this.canvas_div.style.width = width + 'px';
        this.canvas_div.style.height = height + 'px';

        this.update_canvas();
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
                // If clicking on the resize handle
                if (canvas_pos.x >= that.top_canvas.width - that.resize_handle_size &&
                        canvas_pos.y >= that.top_canvas.height - that.resize_handle_size) {
                    that.resizing = true;
                    return;
                } else {
                    that.canvas.focus();
                    that.canvas_div.focus();
                }
            }

            if (that.resizing) {
                // Ignore other mouse events while resizing.
                return;
            }

            if (name === 'motion_notify') {
                // If the mouse is on the handle, change the cursor style
                if (canvas_pos.x >= that.top_canvas.width - that.resize_handle_size &&
                        canvas_pos.y >= that.top_canvas.height - that.resize_handle_size) {
                    that.top_canvas.style.cursor = 'nw-resize';
                } else {
                    that.top_canvas.style.cursor = that.model.get('_cursor');
                }
            }

            // Rate-limit the position text updates so that we don't overwhelm the
            // system.
            if (Date.now() > last_update + 16) {
                last_update = Date.now();

                var x = canvas_pos.x * that.model.ratio;
                var y = canvas_pos.y * that.model.ratio;

                that.model.send_message(name, {x: x, y: y, button: event.button,
                                        step: event.step,
                                        guiEvent: utils.get_simple_keys(event)});
            }

            /* This prevents the web browser from automatically changing to
             * the text insertion cursor when the button is pressed.  We want
             * to control all of the cursor setting manually through the
             * 'cursor' event from matplotlib */
            event.preventDefault();
        };
    },

    resize_event: function(event) {
        if (this.resizing) {
            var new_size = utils.get_mouse_position(event, this.top_canvas);

            this.model.resize(new_size.x, new_size.y);
        }
    },

    stop_resize_event: function() {
        this.resizing = false;
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

            that.model.send_message(name, {key: value, guiEvent: utils.get_simple_keys(event)});
            return false;
        };
    },

    remove: function(){
        window.removeEventListener('mousemove', this._resize_event);
        window.removeEventListener('mouseup', this._stop_resize_event);
    }
});

module.exports = {
    MPLCanvasModel: MPLCanvasModel,
    MPLCanvasView: MPLCanvasView,
    ToolbarModel: toolbar.ToolbarModel,
    ToolbarView: toolbar.ToolbarView
}
