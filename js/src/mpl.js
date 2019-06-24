var utils = require('./utils.js');

figure = function(figure_id, widget) {
    this.id = figure_id;
    this.widget = widget;

    this.context = undefined;
    this.canvas = undefined;
    this.rubberband_canvas = undefined;
    this.rubberband_context = undefined;
    this.format_dropdown = undefined;
    this.figure_label = undefined;
    this.message = undefined;

    this.image_mode = 'full';

    this.root = document.createElement('div');
    this.root.addEventListener('remove', this.close.bind(this));
    this.root.setAttribute('style', 'display: inline-block');

    this._init_header();
    this._init_canvas();
    this._init_image();

    this.waiting = false;

    this.send_message('send_image_mode');
    this.send_message('refresh');

    widget.model.on('msg:custom', this.on_comm_message.bind(this));

    this.send_message('initialized');
};

figure.prototype._init_header = function() {
    this.header = document.createElement('div');
    this.header.setAttribute('style', 'text-align: center;');
    this.header.classList = 'jupyter-widgets widget-label';
    this.root.appendChild(this.header);
};

figure.prototype._init_canvas = function() {
    var canvas_div = this.canvas_div = document.createElement('div');
    canvas_div.setAttribute('style', 'position: relative; clear: both; outline:none');

    canvas_div.addEventListener('keydown', this.key_event('key_press'));
    canvas_div.addEventListener('keyup', this.key_event('key_release'));
    // this is important to make the div 'focusable'
    canvas_div.setAttribute('tabindex', 0);
    this.root.appendChild(canvas_div);

    var canvas = this.canvas = document.createElement('canvas');
    canvas.classList.add('mpl-canvas');
    canvas.setAttribute('style', 'left: 0; top: 0; z-index: 0; ');

    this.context = canvas.getContext('2d');

    var backingStore = this.context.backingStorePixelRatio ||
        this.context.webkitBackingStorePixelRatio ||
        this.context.mozBackingStorePixelRatio ||
        this.context.msBackingStorePixelRatio ||
        this.context.oBackingStorePixelRatio ||
        this.context.backingStorePixelRatio || 1;

    var ratio = this.ratio = (window.devicePixelRatio || 1) / backingStore;
    if (ratio != 1) {
        this.send_message('set_dpi_ratio', {'dpi_ratio': ratio});
    }

    var rubberband_canvas = this.rubberband_canvas = document.createElement('canvas');
    rubberband_canvas.setAttribute('style', 'position: absolute; left: 0; top: 0; z-index: 1;');

    // TODO: on resize event
    // this.request_resize(width, height);

    rubberband_canvas.addEventListener('mousedown', this.mouse_event('button_press'));
    rubberband_canvas.addEventListener('mouseup', this.mouse_event('button_release'));
    rubberband_canvas.addEventListener('mousemove', this.mouse_event('motion_notify'));

    rubberband_canvas.addEventListener('mouseenter', this.mouse_event('figure_enter'));
    rubberband_canvas.addEventListener('mouseleave', this.mouse_event('figure_leave'));

    canvas_div.appendChild(canvas);
    canvas_div.appendChild(rubberband_canvas);

    this.rubberband_context = rubberband_canvas.getContext('2d');
    this.rubberband_context.strokeStyle = '#000000';

    this._resize_canvas = function(width, height) {
        // Keep the size of the canvas, canvas container, and rubber band
        // canvas in synch.
        canvas_div.style.width = width;
        canvas_div.style.height = height;

        canvas.setAttribute('width', width * ratio);
        canvas.setAttribute('height', height * ratio);
        canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');

        rubberband_canvas.setAttribute('width', width);
        rubberband_canvas.setAttribute('height', height);
    };

    // Set the figure to an initial 600x600px, this will subsequently be updated
    // upon first draw.
    this._resize_canvas(600, 600);

    // Disable right mouse context menu.
    this.rubberband_canvas.addEventListener('contextmenu', function(e) {
        return false;
    });
};

figure.prototype._init_image = function() {
    var fig = this;
    this.image = document.createElement('img');
    this.image.style.display = 'none';

    this.root.appendChild(this.image);
    this.image.onload = function() {
        if (fig.image_mode == 'full') {
            // Full images could contain transparency (where diff images
            // almost always do), so we need to clear the canvas so that
            // there is no ghosting.
            fig.context.clearRect(0, 0, fig.canvas.width, fig.canvas.height);
        }
        fig.context.drawImage(fig.image, 0, 0);
    };

    this.image.onunload = function() {
        fig.close();
    }
};

figure.prototype.request_resize = function(x_pixels, y_pixels) {
    // Request matplotlib to resize the figure. Matplotlib will then trigger a resize in the client,
    // which will in turn request a refresh of the image.
    this.send_message('resize', {'width': x_pixels, 'height': y_pixels});
};

figure.prototype.send_message = function(type, properties = {}) {
    properties['type'] = type;
    properties['figure_id'] = this.id;
    this.widget.send(JSON.stringify(properties));
};

figure.prototype.send_draw_message = function() {
    if (!this.waiting) {
        this.waiting = true;
        this.send_message('draw');
    }
};

figure.prototype.handle_save = function() {
    var save = document.createElement('a');
    save.href = this.canvas.toDataURL();
    save.download = this.header.textContent + '.png';
    document.body.appendChild(save);
    save.click();
    document.body.removeChild(save);
};

figure.prototype.handle_resize = function(msg) {
    var size = msg['size'];
    if (size[0] != this.canvas.width || size[1] != this.canvas.height) {
        this._resize_canvas(size[0], size[1]);
        this.send_message('refresh');
    };
};

figure.prototype.handle_rubberband = function(msg) {
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
};

figure.prototype.handle_figure_label = function(msg) {
    // Updates the figure title.
    this.figure_label = msg['label'];
    this.update_header();
};

figure.prototype.handle_message = function(msg) {
    this.message = msg['message'];
    this.update_header();
};

figure.prototype.update_header = function(msg) {
    var header = this.figure_label;
    if (this.message) {
        header += ' (' + this.message + ')';
    }
    this.header.textContent = header;
};

figure.prototype.handle_cursor = function(msg) {
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
};

figure.prototype.handle_draw = function(msg) {
    // Request the server to send over a new figure.
    this.send_draw_message();
};

figure.prototype.handle_binary = function(msg, dataviews) {
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
    if (window.Jupyter) {
        Jupyter.notebook.set_dirty(true);
    }
    this.send_message('ack');

    this.waiting = false;
};

figure.prototype.handle_image_mode = function(msg) {
    this.image_mode = msg['mode'];
};

figure.prototype.on_comm_message = function(evt, dataviews) {
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
};

figure.prototype.mouse_event = function(name) {
    var fig = this;
    return function(event) {
        var canvas_pos = utils.get_mouse_position(event);

        if (name === 'button_press')
        {
            fig.canvas.focus();
            fig.canvas_div.focus();
        }

        var x = canvas_pos.x * fig.ratio;
        var y = canvas_pos.y * fig.ratio;

        fig.send_message(name, {x: x, y: y, button: event.button,
                                step: event.step,
                                guiEvent: utils.get_simple_keys(event)});

        /* This prevents the web browser from automatically changing to
         * the text insertion cursor when the button is pressed.  We want
         * to control all of the cursor setting manually through the
         * 'cursor' event from matplotlib */
        event.preventDefault();
        return false;
    };
};

figure.prototype.key_event = function(name) {
    var fig = this;
    return function(event) {
        event.stopPropagation();
        event.preventDefault();

        // Prevent repeat events
        if (name == 'key_press')
        {
            if (event.which === fig._key)
                return;
            else
                fig._key = event.which;
        }
        if (name == 'key_release')
            fig._key = null;

        var value = '';
        if (event.ctrlKey && event.which != 17)
            value += 'ctrl+';
        if (event.altKey && event.which != 18)
            value += 'alt+';
        if (event.shiftKey && event.which != 16)
            value += 'shift+';

        value += 'k';
        value += event.which.toString();

        fig.send_message(name, {key: value, guiEvent: utils.get_simple_keys(event)});
        return false;
    };
};

figure.prototype.close = function(){
    this.send_message('closing');
    this.widget.comm.close();
};

module.exports = {
    figure: figure
};
