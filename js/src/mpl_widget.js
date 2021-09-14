const widgets = require('@jupyter-widgets/base');
const utils = require('./utils.js');

require('./mpl_widget.css');

const version = require('../package.json').version;

export class MPLCanvasModel extends widgets.DOMWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            _model_name: 'MPLCanvasModel',
            _view_name: 'MPLCanvasView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^' + version,
            _view_module_version: '^' + version,
            header_visible: true,
            footer_visible: true,
            toolbar: null,
            toolbar_visible: true,
            toolbar_position: 'horizontal',
            resizable: true,
            capture_scroll: false,
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
        };
    }

    initialize(attributes, options) {
        super.initialize(attributes, options);

        this.offscreen_canvas = document.createElement('canvas');
        this.offscreen_context = this.offscreen_canvas.getContext('2d');
        const backingStore =
            this.offscreen_context.backingStorePixelRatio ||
            this.offscreen_context.webkitBackingStorePixelRatio ||
            this.offscreen_context.mozBackingStorePixelRatio ||
            this.offscreen_context.msBackingStorePixelRatio ||
            this.offscreen_context.oBackingStorePixelRatio ||
            1;

        this.requested_size = null;
        this.resize_requested = false;
        this.ratio = (window.devicePixelRatio || 1) / backingStore;
        this._init_image();

        this.on('msg:custom', this.on_comm_message.bind(this));
        this.on('change:resizable', () => {
            this._for_each_view(function (view) {
                view.update_canvas();
            });
        });

        this.send_initialization_message();
    }

    send_message(type, message = {}) {
        message['type'] = type;

        this.send(message);
    }

    send_initialization_message() {
        if (this.ratio != 1) {
            this.send_message('set_dpi_ratio', { dpi_ratio: this.ratio });
        }

        this.send_message('send_image_mode');
        this.send_message('refresh');

        this.send_message('initialized');
    }

    send_draw_message() {
        if (!this.waiting) {
            this.waiting = true;
            this.send_message('draw');
        }
    }

    handle_save() {
        const save = document.createElement('a');
        save.href = this.offscreen_canvas.toDataURL();
        save.download = this.get('_figure_label') + '.png';
        document.body.appendChild(save);
        save.click();
        document.body.removeChild(save);
    }

    handle_resize(msg) {
        const size = msg['size'];
        this.resize_canvas(size[0], size[1]);
        this.offscreen_context.drawImage(this.image, 0, 0);

        if (!this.resize_requested) {
            this._for_each_view(function (view) {
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
    }

    resize(width, height) {
        // Do not request a super small size, as it seems to break the back-end
        if (width <= 5 || height <= 5) {
            return;
        }

        this._for_each_view(function (view) {
            // Do an initial resize of each view, stretching the old canvas.
            view.resize_canvas(width, height);
        });

        if (this.resize_requested) {
            // If a resize was already requested, save the requested size for later
            this.requested_size = [width, height];
        } else {
            this.resize_requested = true;
            this.send_message('resize', { width: width, height: height });
        }
    }

    resize_canvas(width, height) {
        this.offscreen_canvas.setAttribute('width', width * this.ratio);
        this.offscreen_canvas.setAttribute('height', height * this.ratio);
    }

    handle_rubberband(msg) {
        let x0 = msg['x0'] / this.ratio;
        let y0 = (this.offscreen_canvas.height - msg['y0']) / this.ratio;
        let x1 = msg['x1'] / this.ratio;
        let y1 = (this.offscreen_canvas.height - msg['y1']) / this.ratio;
        x0 = Math.floor(x0) + 0.5;
        y0 = Math.floor(y0) + 0.5;
        x1 = Math.floor(x1) + 0.5;
        y1 = Math.floor(y1) + 0.5;

        this.set('_rubberband_x', Math.min(x0, x1));
        this.set('_rubberband_y', Math.min(y0, y1));
        this.set('_rubberband_width', Math.abs(x1 - x0));
        this.set('_rubberband_height', Math.abs(y1 - y0));
        this.save_changes();

        this._for_each_view(function (view) {
            view.update_canvas();
        });
    }

    handle_draw(_msg) {
        // Request the server to send over a new figure.
        this.send_draw_message();
    }

    handle_binary(msg, dataviews) {
        const url_creator = window.URL || window.webkitURL;

        const buffer = new Uint8Array(dataviews[0].buffer);
        const blob = new Blob([buffer], { type: 'image/png' });
        const image_url = url_creator.createObjectURL(blob);

        // Free the memory for the previous frames
        if (this.image.src) {
            url_creator.revokeObjectURL(this.image.src);
        }

        this.image.src = image_url;

        // Tell Jupyter that the notebook contents must change.
        this.send_message('ack');

        this.waiting = false;
    }

    on_comm_message(evt, dataviews) {
        const msg = JSON.parse(evt.data);
        const msg_type = msg['type'];
        let callback;

        // Call the  'handle_{type}' callback, which takes
        // the figure and JSON message as its only arguments.
        try {
            callback = this['handle_' + msg_type].bind(this);
        } catch (e) {
            console.log(
                "No handler for the '" + msg_type + "' message type: ",
                msg
            );
            return;
        }

        if (callback) {
            callback(msg, dataviews);
        }
    }

    _init_image() {
        this.image = document.createElement('img');
        this.image.onload = () => {
            if (this.get('_image_mode') == 'full') {
                // Full images could contain transparency (where diff images
                // almost always do), so we need to clear the canvas so that
                // there is no ghosting.
                this.offscreen_context.clearRect(
                    0,
                    0,
                    this.offscreen_canvas.width,
                    this.offscreen_canvas.height
                );
            }
            this.offscreen_context.drawImage(this.image, 0, 0);

            this._for_each_view(function (view) {
                view.update_canvas();
            });
        };
    }

    _for_each_view(callback) {
        for (const view_id in this.views) {
            this.views[view_id].then((view) => {
                callback(view);
            });
        }
    }

    generateMimeBundle() {
        const width = this.offscreen_canvas.width;
        const height = this.offscreen_canvas.height;

        let header = '';
        if (this.get('header_visible')) {
            header = `
                <div style="text-align: center;">${this.get('_figure_label')}</div>
            `
        }

        return {
            'text/html': `
                <div>
                    ${header}
                    <img src="${this.offscreen_canvas.toDataURL('image/png', 1.0)}"
                    width="${width}" height="${height}"
                    style="width: ${width / this.ratio}px; height: ${height / this.ratio}px;"/>
                </div?
            `
        };
    }

    // We want the static figure to overwrite the widget mimebundle on Notebook save
    shouldOverwriteMimeBundle() {
        return true;
    }

    remove() {
        this.send_message('closing');
    }
}

MPLCanvasModel.serializers = {
    ...widgets.DOMWidgetModel.serializers,
    toolbar: { deserialize: widgets.unpack_models },
};

export class MPLCanvasView extends widgets.DOMWidgetView {
    render() {
        this.canvas = undefined;
        this.context = undefined;
        this.top_canvas = undefined;
        this.top_context = undefined;
        this.resizing = false;
        this.resize_handle_size = 20;

        this.figure = document.createElement('div');
        this.figure.classList =
            'jupyter-matplotlib-figure jupyter-widgets widget-container widget-box widget-vbox';

        this._init_header();
        this._init_canvas();
        this._init_footer();

        this._resize_event = this.resize_event.bind(this);
        this._stop_resize_event = this.stop_resize_event.bind(this);
        window.addEventListener('mousemove', this._resize_event);
        window.addEventListener('mouseup', this._stop_resize_event);

        this.waiting = false;

        return this.create_child_view(this.model.get('toolbar')).then(
            (toolbar_view) => {
                this.toolbar_view = toolbar_view;

                this._update_toolbar_position();

                this._update_header_visible();
                this._update_footer_visible();
                this._update_toolbar_visible();

                this.model_events();
            }
        );
    }

    model_events() {
        this.model.on(
            'change:header_visible',
            this._update_header_visible.bind(this)
        );
        this.model.on(
            'change:footer_visible',
            this._update_footer_visible.bind(this)
        );
        this.model.on(
            'change:toolbar_visible',
            this._update_toolbar_visible.bind(this)
        );
        this.model.on(
            'change:toolbar_position',
            this._update_toolbar_position.bind(this)
        );
        this.model.on(
            'change:_figure_label',
            this._update_figure_label.bind(this)
        );
        this.model.on('change:_message', this._update_message.bind(this));
        this.model.on('change:_cursor', this._update_cursor.bind(this));
    }

    _update_header_visible() {
        this.header.style.display = this.model.get('header_visible')
            ? ''
            : 'none';
    }

    _update_footer_visible() {
        this.footer.style.display = this.model.get('footer_visible')
            ? ''
            : 'none';
    }

    _update_toolbar_visible() {
        this.toolbar_view.el.style.display = this.model.get('toolbar_visible')
            ? ''
            : 'none';
    }

    _update_toolbar_position() {
        const toolbar_position = this.model.get('toolbar_position');
        if (toolbar_position == 'top' || toolbar_position == 'bottom') {
            this.el.classList =
                'jupyter-widgets widget-container widget-box widget-vbox jupyter-matplotlib';
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
            this.el.classList =
                'jupyter-widgets widget-container widget-box widget-hbox jupyter-matplotlib';
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
    }

    clear() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
    }

    _init_header() {
        this.header = document.createElement('div');
        this.header.style.textAlign = 'center';
        this.header.classList = 'jupyter-widgets widget-label';
        this._update_figure_label();
        this.figure.appendChild(this.header);
    }

    _update_figure_label(_msg) {
        this.header.textContent = this.model.get('_figure_label');
    }

    _init_canvas() {
        const canvas_container = document.createElement('div');
        canvas_container.classList =
            'jupyter-widgets jupyter-matplotlib-canvas-container';
        this.figure.appendChild(canvas_container);

        const canvas_div = (this.canvas_div = document.createElement('div'));
        canvas_div.style.position = 'relative';
        canvas_div.style.clear = 'both';
        canvas_div.classList = 'jupyter-widgets jupyter-matplotlib-canvas-div';

        canvas_div.addEventListener('keydown', this.key_event('key_press'));
        canvas_div.addEventListener('keyup', this.key_event('key_release'));

        // this is important to make the div 'focusable'
        canvas_div.setAttribute('tabindex', 0);
        canvas_container.appendChild(canvas_div);

        const canvas = (this.canvas = document.createElement('canvas'));
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.left = 0;
        canvas.style.top = 0;
        canvas.style.zIndex = 0;

        this.context = canvas.getContext('2d');

        const top_canvas = (this.top_canvas = document.createElement('canvas'));
        top_canvas.style.display = 'block';
        top_canvas.style.position = 'absolute';
        top_canvas.style.left = 0;
        top_canvas.style.top = 0;
        top_canvas.style.zIndex = 1;

        top_canvas.addEventListener(
            'mousedown',
            this.mouse_event('button_press')
        );
        top_canvas.addEventListener(
            'mouseup',
            this.mouse_event('button_release')
        );
        top_canvas.addEventListener(
            'mousemove',
            this.mouse_event('motion_notify')
        );

        top_canvas.addEventListener(
            'mouseenter',
            this.mouse_event('figure_enter')
        );
        top_canvas.addEventListener(
            'mouseleave',
            this.mouse_event('figure_leave')
        );

        top_canvas.addEventListener('wheel', this.mouse_event('scroll'));

        canvas_div.appendChild(canvas);
        canvas_div.appendChild(top_canvas);

        this.top_context = top_canvas.getContext('2d');
        this.top_context.strokeStyle = 'rgba(0, 0, 0, 255)';

        // Disable right mouse context menu.
        this.top_canvas.addEventListener('contextmenu', function (_e) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        });

        this.resize_canvas(this.model.get('_width'), this.model.get('_height'));
        this.update_canvas();
    }

    update_canvas() {
        if (this.canvas.width == 0 || this.canvas.height == 0) {
            return;
        }

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.model.offscreen_canvas, 0, 0);

        this.top_context.clearRect(
            0,
            0,
            this.top_canvas.width,
            this.top_canvas.height
        );

        // Draw rubberband
        if (
            this.model.get('_rubberband_width') != 0 &&
            this.model.get('_rubberband_height') != 0
        ) {
            this.top_context.strokeRect(
                this.model.get('_rubberband_x'),
                this.model.get('_rubberband_y'),
                this.model.get('_rubberband_width'),
                this.model.get('_rubberband_height')
            );
        }

        // Draw resize handle
        if (this.model.get('resizable')) {
            this.top_context.save();

            var gradient = this.top_context.createLinearGradient(
                this.top_canvas.width - this.resize_handle_size / 3,
                this.top_canvas.height - this.resize_handle_size / 3,
                this.top_canvas.width - this.resize_handle_size / 4,
                this.top_canvas.height - this.resize_handle_size / 4
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 255)');

            this.top_context.fillStyle = gradient;

            this.top_context.globalAlpha = 0.3;
            this.top_context.beginPath();
            this.top_context.moveTo(
                this.top_canvas.width,
                this.top_canvas.height
            );
            this.top_context.lineTo(
                this.top_canvas.width,
                this.top_canvas.height - this.resize_handle_size
            );
            this.top_context.lineTo(
                this.top_canvas.width - this.resize_handle_size,
                this.top_canvas.height
            );
            this.top_context.closePath();
            this.top_context.fill();

            this.top_context.restore();
        }
    }

    _update_cursor() {
        this.top_canvas.style.cursor = this.model.get('_cursor');
    }

    _init_footer() {
        this.footer = document.createElement('div');
        this.footer.style.textAlign = 'center';
        this.footer.classList = 'jupyter-widgets widget-label';
        this._update_message();
        this.figure.appendChild(this.footer);
    }

    _update_message() {
        this.footer.textContent = this.model.get('_message');
    }

    resize_canvas(width, height) {
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
    }

    mouse_event(name) {
        let last_update = 0;
        return (event) => {
            const canvas_pos = utils.get_mouse_position(event, this.top_canvas);

            if (name === 'scroll') {
                event['data'] = 'scroll';
                if (event.deltaY < 0) {
                    event.step = 1;
                } else {
                    event.step = -1;
                }
                if (this.model.get('capture_scroll')) {
                    event.preventDefault();
                }
            }

            if (name === 'button_press') {
                // If clicking on the resize handle
                if (
                    canvas_pos.x >=
                        this.top_canvas.width - this.resize_handle_size &&
                    canvas_pos.y >=
                        this.top_canvas.height - this.resize_handle_size &&
                    this.model.get('resizable')
                ) {
                    this.resizing = true;
                    return;
                } else {
                    this.canvas.focus();
                    this.canvas_div.focus();
                }
            }

            if (this.resizing) {
                // Ignore other mouse events while resizing.
                return;
            }

            if (name === 'motion_notify') {
                // If the mouse is on the handle, change the cursor style
                if (
                    canvas_pos.x >=
                        this.top_canvas.width - this.resize_handle_size &&
                    canvas_pos.y >=
                        this.top_canvas.height - this.resize_handle_size
                ) {
                    this.top_canvas.style.cursor = 'nw-resize';
                } else {
                    this.top_canvas.style.cursor = this.model.get('_cursor');
                }
            }

            // Rate-limit the position text updates so that we don't overwhelm the
            // system.
            if (Date.now() > last_update + 16) {
                last_update = Date.now();

                var x = canvas_pos.x * this.model.ratio;
                var y = canvas_pos.y * this.model.ratio;

                this.model.send_message(name, {
                    x: x,
                    y: y,
                    button: event.button,
                    step: event.step,
                    guiEvent: utils.get_simple_keys(event),
                });
            }
        };
    }

    resize_event(event) {
        if (this.resizing) {
            const new_size = utils.get_mouse_position(event, this.top_canvas);

            this.model.resize(new_size.x, new_size.y);
        }
    }

    stop_resize_event() {
        this.resizing = false;
    }

    key_event(name) {
        return (event) => {
            event.stopPropagation();
            event.preventDefault();

            // Prevent repeat events
            if (name == 'key_press') {
                if (event.which === this._key) {
                    return;
                } else {
                    this._key = event.which;
                }
            }
            if (name == 'key_release') {
                this._key = null;
            }

            var value = '';
            if (event.ctrlKey && event.which != 17) {
                value += 'ctrl+';
            }
            if (event.altKey && event.which != 18) {
                value += 'alt+';
            }
            if (event.shiftKey && event.which != 16) {
                value += 'shift+';
            }

            value += 'k';
            value += event.which.toString();

            this.model.send_message(name, {
                key: value,
                guiEvent: utils.get_simple_keys(event),
            });
            return false;
        };
    }

    remove() {
        window.removeEventListener('mousemove', this._resize_event);
        window.removeEventListener('mouseup', this._stop_resize_event);
    }
}
