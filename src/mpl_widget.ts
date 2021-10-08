import {
    DOMWidgetModel,
    DOMWidgetView,
    WidgetModel,
    ISerializers,
    unpack_models,
} from '@jupyter-widgets/base';

import * as utils from './utils';

import { MODULE_VERSION } from './version';

export class MPLCanvasModel extends DOMWidgetModel {
    offscreen_canvas: HTMLCanvasElement;
    offscreen_context: CanvasRenderingContext2D;
    requested_size: Array<number> | null;
    resize_requested: boolean;
    ratio: number;
    waiting_for_image: boolean;
    image: HTMLImageElement;

    defaults() {
        return {
            ...super.defaults(),
            _model_name: 'MPLCanvasModel',
            _view_name: 'MPLCanvasView',
            _model_module: 'jupyter-matplotlib',
            _view_module: 'jupyter-matplotlib',
            _model_module_version: '^' + MODULE_VERSION,
            _view_module_version: '^' + MODULE_VERSION,
            header_visible: true,
            footer_visible: true,
            toolbar: null,
            toolbar_visible: true,
            toolbar_position: 'horizontal',
            resizable: true,
            capture_scroll: false,
            _data_url: null,
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

    static serializers: ISerializers = {
        ...DOMWidgetModel.serializers,
        toolbar: { deserialize: unpack_models as any },
    };

    initialize(attributes: any, options: any) {
        super.initialize(attributes, options);

        this.offscreen_canvas = document.createElement('canvas');
        this.offscreen_context = utils.getContext(this.offscreen_canvas);

        // use `as any` to avoid typescript complaining that
        // these browser specific attributes don't exist.
        const context = this.offscreen_context as any;
        const backingStore =
            context.backingStorePixelRatio ||
            context.webkitBackingStorePixelRatio ||
            context.mozBackingStorePixelRatio ||
            context.msBackingStorePixelRatio ||
            context.oBackingStorePixelRatio ||
            1;

        this.requested_size = null;
        this.resize_requested = false;
        this.ratio = (window.devicePixelRatio || 1) / backingStore;

        this.resize_canvas(this.get('_width'), this.get('_height'));

        this._init_image();

        this.on('msg:custom', this.on_comm_message.bind(this));
        this.on('change:resizable', () => {
            this._for_each_view((view: MPLCanvasView) => {
                view.update_canvas();
            });
        });
        this.on('comm_live_update', this.update_disabled.bind(this));

        this.update_disabled();

        this.send_initialization_message();
    }

    get disabled(): boolean {
        return !this.comm_live;
    }

    update_disabled(): void {
        this.set('resizable', !this.disabled);
    }

    sync(method: string, model: WidgetModel, options: any = {}) {
        // Make sure we don't sync the data_url, we don't need it to be synced
        if (options.attrs) {
            delete options.attrs['_data_url'];
        }

        super.sync(method, model, options);
    }

    send_message(type: string, message: { [index: string]: any } = {}) {
        message['type'] = type;

        this.send(message, {});
    }

    send_initialization_message() {
        if (this.ratio !== 1) {
            this.send_message('set_dpi_ratio', { dpi_ratio: this.ratio });
            this.send_message('set_device_pixel_ratio', {
                device_pixel_ratio: this.ratio,
            });
        }

        this.send_message('refresh');
        this.send_message('send_image_mode');

        this.send_message('initialized');
    }

    send_draw_message() {
        if (!this.waiting_for_image) {
            this.waiting_for_image = true;
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

    handle_resize(msg: { [index: string]: any }) {
        const size = msg['size'];
        this.resize_canvas(size[0], size[1]);
        this.offscreen_context.drawImage(this.image, 0, 0);

        if (!this.resize_requested) {
            this._for_each_view((view: MPLCanvasView) => {
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

    resize(width: number, height: number) {
        // Do not request a super small size, as it seems to break the back-end
        if (width <= 5 || height <= 5) {
            return;
        }

        this._for_each_view((view: MPLCanvasView) => {
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

    resize_canvas(width: number, height: number) {
        this.offscreen_canvas.width = width * this.ratio;
        this.offscreen_canvas.height = height * this.ratio;
    }

    handle_rubberband(msg: any) {
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

        this._for_each_view((view: MPLCanvasView) => {
            view.update_canvas();
        });
    }

    handle_draw(_msg: any) {
        // Request the server to send over a new figure.
        this.send_draw_message();
    }

    handle_binary(msg: any, dataviews: any) {
        const url_creator = window.URL || window.webkitURL;

        const buffer = new Uint8Array(dataviews[0].buffer);
        const blob = new Blob([buffer], { type: 'image/png' });
        const image_url = url_creator.createObjectURL(blob);

        // Free the memory for the previous frames
        if (this.image.src) {
            url_creator.revokeObjectURL(this.image.src);
        }

        this.image.src = image_url;

        this.set('_data_url', this.offscreen_canvas.toDataURL());

        this.waiting_for_image = false;
    }

    handle_history_buttons(msg: any) {
        // No-op
    }

    handle_navigate_mode(msg: any) {
        // TODO: Remove _current_action property in the toolbar and use
        // this message instead to know which is the current mode/which
        // button to toggle?
    }

    on_comm_message(evt: any, dataviews: any) {
        const msg = JSON.parse(evt.data);
        const msg_type = msg['type'];
        let callback;

        // Call the  'handle_{type}' callback, which takes
        // the figure and JSON message as its only arguments.
        try {
            callback = (this as any)['handle_' + msg_type].bind(this);
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
        this.image = new Image();

        this.image.onload = () => {
            if (this.get('_image_mode') === 'full') {
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

            this._for_each_view((view: MPLCanvasView) => {
                view.update_canvas();
            });
        };

        const dataUrl = this.get('_data_url');

        if (dataUrl !== null) {
            this.image.src = dataUrl;
        }
    }

    _for_each_view(callback: any) {
        for (const view_id in this.views) {
            this.views[view_id].then((view) => {
                callback(view);
            });
        }
    }

    remove() {
        this.send_message('closing');
    }
}

export class MPLCanvasView extends DOMWidgetView {
    figure: HTMLDivElement;
    canvas_div: HTMLDivElement;
    canvas: HTMLCanvasElement;
    header: HTMLDivElement;
    toolbar_view: DOMWidgetView;
    resize_handle_size: number;
    resizing: boolean;
    context: CanvasRenderingContext2D;
    top_canvas: HTMLCanvasElement;
    top_context: CanvasRenderingContext2D;
    footer: HTMLDivElement;
    model: MPLCanvasModel;
    private _key: string | null;
    private _resize_event: (event: MouseEvent) => void;
    private _stop_resize_event: () => void;

    render() {
        this.resizing = false;
        this.resize_handle_size = 20;

        this.figure = document.createElement('div');
        this.figure.classList.add(
            'jupyter-matplotlib-figure',
            'jupyter-widgets',
            'widget-container',
            'widget-box',
            'widget-vbox'
        );

        this._init_header();
        this._init_canvas();
        this._init_footer();

        this._resize_event = this.resize_event.bind(this);
        this._stop_resize_event = this.stop_resize_event.bind(this);
        window.addEventListener('mousemove', this._resize_event);
        window.addEventListener('mouseup', this._stop_resize_event);

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
        if (toolbar_position === 'top' || toolbar_position === 'bottom') {
            this.el.classList.add(
                'jupyter-widgets',
                'widget-container',
                'widget-box',
                'widget-vbox',
                'jupyter-matplotlib'
            );
            this.model.get('toolbar').set('orientation', 'horizontal');

            this.clear();

            if (toolbar_position === 'top') {
                this.el.appendChild(this.toolbar_view.el);
                this.el.appendChild(this.figure);
            } else {
                this.el.appendChild(this.figure);
                this.el.appendChild(this.toolbar_view.el);
            }
        } else {
            this.el.classList.add(
                'jupyter-widgets',
                'widget-container',
                'widget-box',
                'widget-hbox',
                'jupyter-matplotlib'
            );
            this.model.get('toolbar').set('orientation', 'vertical');

            this.clear();

            if (toolbar_position === 'left') {
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
        this.header.classList.add('jupyter-widgets', 'widget-label');
        this._update_figure_label();
        this.figure.appendChild(this.header);
    }

    _update_figure_label() {
        this.header.textContent = this.model.get('_figure_label');
    }

    _init_canvas() {
        const canvas_container = document.createElement('div');
        canvas_container.classList.add(
            'jupyter-widgets',
            'jupyter-matplotlib-canvas-container'
        );
        this.figure.appendChild(canvas_container);

        const canvas_div = (this.canvas_div = document.createElement('div'));
        canvas_div.style.position = 'relative';
        canvas_div.style.clear = 'both';
        canvas_div.classList.add(
            'jupyter-widgets',
            'jupyter-matplotlib-canvas-div'
        );

        canvas_div.addEventListener('keydown', this.key_event('key_press'));
        canvas_div.addEventListener('keyup', this.key_event('key_release'));

        // this is important to make the div 'focusable'
        canvas_div.setAttribute('tabindex', '0');
        canvas_container.appendChild(canvas_div);

        const canvas = (this.canvas = document.createElement('canvas'));
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.zIndex = '0';

        this.context = utils.getContext(canvas);

        const top_canvas = (this.top_canvas = document.createElement('canvas'));
        top_canvas.style.display = 'block';
        top_canvas.style.position = 'absolute';
        top_canvas.style.left = '0';
        top_canvas.style.top = '0';
        top_canvas.style.zIndex = '1';

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

        this.top_context = utils.getContext(top_canvas);
        this.top_context.strokeStyle = 'rgba(0, 0, 0, 255)';

        // Disable right mouse context menu.
        this.top_canvas.addEventListener('contextmenu', (_e) => {
            _e.preventDefault();
            _e.stopPropagation();
            return false;
        });

        this.resize_canvas(this.model.get('_width'), this.model.get('_height'));
        this.update_canvas();
    }

    update_canvas() {
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            return;
        }

        this.top_context.save();

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
            this.model.get('_rubberband_width') !== 0 &&
            this.model.get('_rubberband_height') !== 0
        ) {
            this.top_context.strokeStyle = 'gray';
            this.top_context.lineWidth = 1;
            this.top_context.shadowColor = 'black';
            this.top_context.shadowBlur = 2;
            this.top_context.shadowOffsetX = 1;
            this.top_context.shadowOffsetY = 1;

            this.top_context.strokeRect(
                this.model.get('_rubberband_x'),
                this.model.get('_rubberband_y'),
                this.model.get('_rubberband_width'),
                this.model.get('_rubberband_height')
            );
        }

        // Draw resize handle
        if (this.model.get('resizable')) {
            const gradient = this.top_context.createLinearGradient(
                // Start
                this.top_canvas.width - this.resize_handle_size,
                this.top_canvas.height - this.resize_handle_size,
                // Stop
                this.top_canvas.width,
                this.top_canvas.height
            );
            gradient.addColorStop(0, 'white');
            gradient.addColorStop(1, 'black');

            this.top_context.fillStyle = gradient;
            this.top_context.strokeStyle = 'gray';

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
            this.top_context.stroke();
        }

        this.top_context.restore();
    }

    _update_cursor() {
        this.top_canvas.style.cursor = this.model.get('_cursor');
    }

    _init_footer() {
        this.footer = document.createElement('div');
        this.footer.style.textAlign = 'center';
        this.footer.classList.add('jupyter-widgets', 'widget-label');
        this._update_message();
        this.figure.appendChild(this.footer);
    }

    _update_message() {
        this.footer.textContent = this.model.get('_message');
    }

    resize_canvas(width: number, height: number) {
        // Keep the size of the canvas, and rubber band canvas in sync.
        this.canvas.setAttribute('width', `${width * this.model.ratio}`);
        this.canvas.setAttribute('height', `${height * this.model.ratio}`);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.top_canvas.setAttribute('width', String(width));
        this.top_canvas.setAttribute('height', String(height));

        this.canvas_div.style.width = width + 'px';
        this.canvas_div.style.height = height + 'px';

        this.update_canvas();
    }

    mouse_event(name: string) {
        let last_update = 0;
        return (event: any) => {
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

                const x = canvas_pos.x * this.model.ratio;
                const y = canvas_pos.y * this.model.ratio;

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

    resize_event(event: MouseEvent) {
        if (this.resizing) {
            const new_size = utils.get_mouse_position(event, this.top_canvas);

            this.model.resize(new_size.x, new_size.y);
        }
    }

    stop_resize_event() {
        this.resizing = false;
    }

    key_event(name: string) {
        return (event: KeyboardEvent) => {
            event.stopPropagation();
            event.preventDefault();

            // Prevent repeat events
            if (name === 'key_press') {
                if (event.key === this._key) {
                    return;
                } else {
                    this._key = event.key;
                }
            }
            if (name === 'key_release') {
                this._key = null;
            }

            let value = '';
            if (event.ctrlKey && event.key !== 'Control') {
                value += 'ctrl+';
            } else if (event.altKey && event.key !== 'Alt') {
                value += 'alt+';
            } else if (event.shiftKey && event.key !== 'Shift') {
                value += 'shift+';
            }

            value += 'k' + event.key;
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
