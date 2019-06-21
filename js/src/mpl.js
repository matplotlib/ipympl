window.mpl = {};

function offset(el) {
    var boundingRect = el.getBoundingClientRect();
    return {
        top: boundingRect.top + document.body.scrollTop,
        left: boundingRect.left + document.body.scrollLeft
    }
}


mpl.figure = function(figure_id, widget, toolbar_items) {
    this.id = figure_id;
    this.widget = widget;
    this.toolbar_items = toolbar_items;

    this.context = undefined;
    this.message = undefined;
    this.canvas = undefined;
    this.rubberband_canvas = undefined;
    this.rubberband_context = undefined;
    this.format_dropdown = undefined;

    this.image_mode = 'full';

    this.root = document.createElement('div');
    this._root_extra_style(this.root)
    this.root.setAttribute('style', 'display: inline-block');

    widget.el.appendChild(this.root);

    this._init_header(this);
    this._init_canvas(this);
    this._init_toolbar(this);
    this._init_image(this);

    this.waiting = false;

    this.send_message("supports_binary", {value: true});
    this.send_message("send_image_mode", {});
    if (mpl.ratio != 1) {
        this.send_message("set_dpi_ratio", {'dpi_ratio': mpl.ratio});
    }
    this.send_message("refresh", {});

    widget.model.on('msg:custom', this._make_on_message_function(this));
}

mpl.figure.prototype._init_header = function() {
    this.header = document.createElement('div');
    this.header.setAttribute('style', 'text-align: center;');
    this.header.classList = 'jupyter-widgets widget-label';
    this.root.appendChild(this.header);
}

mpl.figure.prototype._canvas_extra_style = function(canvas_div) {
    // this is important to make the div 'focusable'
    canvas_div.setAttribute('tabindex', 0);
}

mpl.figure.prototype._root_extra_style = function(canvas_div) {
    var fig = this;
    canvas_div.addEventListener('remove', function(){
        fig.close(fig, {});
    });
}

mpl.figure.prototype.close = function(fig, msg){
    fig.send_message('closing', msg);
    fig.widget.comm.close();
}

mpl.figure.prototype._init_canvas = function() {
    var fig = this;

    var canvas_div = document.createElement('div');
    canvas_div.setAttribute('style', 'position: relative; clear: both; outline:none');

    function on_keyboard_event_closure(name) {
        return function(event) {
            event.stopPropagation();
            event.preventDefault();
            return fig.key_event(event, name);
        };
    }

    canvas_div.addEventListener('keydown', on_keyboard_event_closure('key_press'));
    canvas_div.addEventListener('keyup', on_keyboard_event_closure('key_release'));
    this.canvas_div = canvas_div;
    this._canvas_extra_style(canvas_div);
    this.root.appendChild(canvas_div);

    var canvas = this.canvas = document.createElement('canvas');
    canvas.classList.add('mpl-canvas');
    canvas.setAttribute('style', "left: 0; top: 0; z-index: 0; ");

    this.context = canvas.getContext("2d");

    var backingStore = this.context.backingStorePixelRatio ||
        this.context.webkitBackingStorePixelRatio ||
        this.context.mozBackingStorePixelRatio ||
        this.context.msBackingStorePixelRatio ||
        this.context.oBackingStorePixelRatio ||
        this.context.backingStorePixelRatio || 1;

    mpl.ratio = (window.devicePixelRatio || 1) / backingStore;

    var rubberband_canvas = this.rubberband_canvas = document.createElement('canvas');
    rubberband_canvas.setAttribute('style', "position: absolute; left: 0; top: 0; z-index: 1;")

    // TODO: on resize event
    // fig.request_resize(width, height);

    function on_mouse_event_closure(name) {
        return function(event) {
            return fig.mouse_event(event, name);
        };
    }

    rubberband_canvas.addEventListener('mousedown', on_mouse_event_closure('button_press'));
    rubberband_canvas.addEventListener('mouseup', on_mouse_event_closure('button_release'));
    // Throttle sequential mouse events to 1 every 20ms.
    rubberband_canvas.addEventListener('mousemove', on_mouse_event_closure('motion_notify'));

    rubberband_canvas.addEventListener('mouseenter', on_mouse_event_closure('figure_enter'));
    rubberband_canvas.addEventListener('mouseleave', on_mouse_event_closure('figure_leave'));

    canvas_div.addEventListener('wheel', function (event) {
        event = event.originalEvent;
        event['data'] = 'scroll'
        if (event.deltaY < 0) {
            event.step = 1;
        } else {
            event.step = -1;
        }
        mouse_event_fn(event);
    });

    canvas_div.appendChild(canvas);
    canvas_div.appendChild(rubberband_canvas);

    this.rubberband_context = rubberband_canvas.getContext("2d");
    this.rubberband_context.strokeStyle = "#000000";

    this._resize_canvas = function(width, height) {
        // Keep the size of the canvas, canvas container, and rubber band
        // canvas in synch.
        canvas_div.style.width = width;
        canvas_div.style.height = height;

        canvas.setAttribute('width', width * mpl.ratio);
        canvas.setAttribute('height', height * mpl.ratio);
        canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');

        rubberband_canvas.setAttribute('width', width);
        rubberband_canvas.setAttribute('height', height);
    }

    // Set the figure to an initial 600x600px, this will subsequently be updated
    // upon first draw.
    this._resize_canvas(600, 600);

    // Disable right mouse context menu.
    this.rubberband_canvas.addEventListener('contextmenu', function(e) {
        return false;
    });
}


mpl.figure.prototype._init_image = function() {
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
}


mpl.figure.prototype._init_toolbar = function() {
    var fig = this;

    var toolbar_container = this.toolbar = document.createElement('div');
    toolbar_container.classList = 'jupyter-widgets widget-container widget-box widget-hbox';
    this.root.prepend(toolbar_container);

    function on_click_closure(name) {
        return function on_click() {
            fig.toolbar_button_onclick(name);
        };
    }

    function on_mouseover_closure(tooltip) {
        return function on_mouseover() {
            return fig.toolbar_button_onmouseover(tooltip);
        };
    }

    // Add the stop interaction button to the window.
    var button = document.createElement('button');
    button.classList = 'jupyter-widgets jupyter-button';
    button.setAttribute('href', '#');
    button.setAttribute('title', 'Toggle Interaction');
    button.setAttribute('style', 'outline:none');
    button.addEventListener('click', function (evt) { fig.toggle_interaction(fig, {}); } );
    button.addEventListener('mouseover', on_mouseover_closure('Toggle Interaction'));

    var icon = document.createElement('i');
    icon.classList = 'fa fa-bars';
    button.appendChild(icon);

    toolbar_container.appendChild(button);

    var toolbar = this.toolbar = document.createElement('div');
    toolbar.classList = 'jupyter-widgets widget-container widget-box widget-hbox';
    toolbar_container.appendChild(toolbar);

    for(var toolbar_ind in this.toolbar_items) {
        var name = this.toolbar_items[toolbar_ind][0];
        var tooltip = this.toolbar_items[toolbar_ind][1];
        var image = this.toolbar_items[toolbar_ind][2];
        var method_name = this.toolbar_items[toolbar_ind][3];
        if (!name) { continue; };

        var button = document.createElement('button');
        button.classList = 'jupyter-widgets jupyter-button';
        button.setAttribute('href', '#');
        button.setAttribute('title', name);
        button.setAttribute('style', 'outline:none');
        button.addEventListener('click', on_click_closure(method_name));
        button.addEventListener('mouseover', on_mouseover_closure(tooltip));

        var icon = document.createElement('i');
        icon.classList = 'fa ' + image;
        button.appendChild(icon);

        toolbar.appendChild(button);
    }

    // Add the status bar.
    var status_bar = document.createElement('div');
    status_bar.classList = 'jupyter-widgets widget-label';
    toolbar.appendChild(status_bar);
    this.message = status_bar;
}

mpl.figure.prototype.toggle_interaction = function(fig, msg) {
    // Toggle the interactivity of the figure.
    var visible = fig.toolbar.style.display !== 'none';
    if (visible) {
        fig.toolbar.style.display = 'none';
    } else {
        fig.toolbar.style.display = '';
    }
}

mpl.figure.prototype.request_resize = function(x_pixels, y_pixels) {
    // Request matplotlib to resize the figure. Matplotlib will then trigger a resize in the client,
    // which will in turn request a refresh of the image.
    this.send_message('resize', {'width': x_pixels, 'height': y_pixels});
}

mpl.figure.prototype.send_message = function(type, properties) {
    properties['type'] = type;
    properties['figure_id'] = this.id;
    this.widget.send(JSON.stringify(properties));
}

mpl.figure.prototype.send_draw_message = function() {
    if (!this.waiting) {
        this.waiting = true;
        this.widget.send(JSON.stringify({type: "draw", figure_id: this.id}));
    }
}

mpl.figure.prototype.handle_save = function(fig, msg) {
    var save = document.createElement('a');
    save.href = fig.image.src;
    save.download = fig.header.textContent + '.png';
    document.body.appendChild(save);
    save.click();
    document.body.removeChild(save);
}


mpl.figure.prototype.handle_resize = function(fig, msg) {
    var size = msg['size'];
    if (size[0] != fig.canvas.width || size[1] != fig.canvas.height) {
        fig._resize_canvas(size[0], size[1]);
        fig.send_message("refresh", {});
    };
}

mpl.figure.prototype.handle_rubberband = function(fig, msg) {
    var x0 = msg['x0'] / mpl.ratio;
    var y0 = (fig.canvas.height - msg['y0']) / mpl.ratio;
    var x1 = msg['x1'] / mpl.ratio;
    var y1 = (fig.canvas.height - msg['y1']) / mpl.ratio;
    x0 = Math.floor(x0) + 0.5;
    y0 = Math.floor(y0) + 0.5;
    x1 = Math.floor(x1) + 0.5;
    y1 = Math.floor(y1) + 0.5;
    var min_x = Math.min(x0, x1);
    var min_y = Math.min(y0, y1);
    var width = Math.abs(x1 - x0);
    var height = Math.abs(y1 - y0);

    fig.rubberband_context.clearRect(
        0, 0, fig.canvas.width, fig.canvas.height);

    fig.rubberband_context.strokeRect(min_x, min_y, width, height);
}

mpl.figure.prototype.handle_figure_label = function(fig, msg) {
    // Updates the figure title.
    fig.header.textContent = msg['label'];
}

mpl.figure.prototype.handle_cursor = function(fig, msg) {
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
    fig.rubberband_canvas.style.cursor = cursor;
}

mpl.figure.prototype.handle_message = function(fig, msg) {
    fig.message.textContent = msg['message'];
}

mpl.figure.prototype.handle_draw = function(fig, msg) {
    // Request the server to send over a new figure.
    fig.send_draw_message();
}

mpl.figure.prototype.handle_image_mode = function(fig, msg) {
    fig.image_mode = msg['mode'];
}

mpl.figure.prototype.updated_canvas_event = function() {
    // Tell Jupyter that the notebook contents must change.
    if (window.Jupyter) {
        Jupyter.notebook.set_dirty(true);
    }
    this.send_message("ack", {});
}

// A function to construct a web socket function for onmessage handling.
// Called in the figure constructor.
mpl.figure.prototype._make_on_message_function = function(fig) {
    return function(evt, dataviews) {
        var msg = JSON.parse(evt.data);
        var msg_type = msg['type'];

        if (msg_type == 'binary') {
            var url_creator = window.URL || window.webkitURL;

            var buffer = new Uint8Array(dataviews[0].buffer);
            var blob = new Blob([buffer], {type: "image/png"});
            var image_url = url_creator.createObjectURL(blob);

            // Free the memory for the previous frames
            if (fig.image.src) {
                url_creator.revokeObjectURL(fig.image.src);
            }

            fig.image.src = image_url;
            fig.updated_canvas_event();
            fig.waiting = false;

            return;
        }

        // Call the  "handle_{type}" callback, which takes
        // the figure and JSON message as its only arguments.
        try {
            var callback = fig["handle_" + msg_type];
        } catch (e) {
            console.log("No handler for the '" + msg_type + "' message type: ", msg);
            return;
        }

        if (callback) {
            try {
                // console.log("Handling '" + msg_type + "' message: ", msg);
                callback(fig, msg);
            } catch (e) {
                console.log("Exception inside the 'handler_" + msg_type + "' callback:", e, e.stack, msg);
            }
        }
    };
}

// from http://stackoverflow.com/questions/1114465/getting-mouse-location-in-canvas
mpl.findpos = function(e) {
    //this section is from http://www.quirksmode.org/js/events_properties.html
    var targ;
    if (!e)
        e = window.event;
    if (e.target)
        targ = e.target;
    else if (e.srcElement)
        targ = e.srcElement;
    if (targ.nodeType == 3) // defeat Safari bug
        targ = targ.parentNode;

    // jQuery normalizes the pageX and pageY
    // pageX,Y are the mouse positions relative to the document
    // offset() returns the position of the element relative to the document
    var targ_offset = offset(targ);
    var x = e.pageX - targ_offset.left;
    var y = e.pageY - targ_offset.top;

    return {"x": x, "y": y};
};

/*
 * return a copy of an object with only non-object keys
 * we need this to avoid circular references
 * http://stackoverflow.com/a/24161582/3208463
 */
function simpleKeys (original) {
  return Object.keys(original).reduce(function (obj, key) {
    if (typeof original[key] !== 'object')
        obj[key] = original[key]
    return obj;
  }, {});
}

mpl.figure.prototype.mouse_event = function(event, name) {
    var canvas_pos = mpl.findpos(event)

    if (name === 'button_press')
    {
        this.canvas.focus();
        this.canvas_div.focus();
    }

    var x = canvas_pos.x * mpl.ratio;
    var y = canvas_pos.y * mpl.ratio;

    this.send_message(name, {x: x, y: y, button: event.button,
                             step: event.step,
                             guiEvent: simpleKeys(event)});

    /* This prevents the web browser from automatically changing to
     * the text insertion cursor when the button is pressed.  We want
     * to control all of the cursor setting manually through the
     * 'cursor' event from matplotlib */
    event.preventDefault();
    return false;
}

mpl.figure.prototype.key_event = function(event, name) {

    // Prevent repeat events
    if (name == 'key_press')
    {
        if (event.which === this._key)
            return;
        else
            this._key = event.which;
    }
    if (name == 'key_release')
        this._key = null;

    var value = '';
    if (event.ctrlKey && event.which != 17)
        value += "ctrl+";
    if (event.altKey && event.which != 18)
        value += "alt+";
    if (event.shiftKey && event.which != 16)
        value += "shift+";

    value += 'k';
    value += event.which.toString();

    this.send_message(name, {key: value,
                             guiEvent: simpleKeys(event)});
    return false;
}

mpl.figure.prototype.toolbar_button_onclick = function(name) {
    if (name == 'download') {
        this.handle_save(this, null);
    } else {
        this.send_message("toolbar_button", {'name': name});
    }
};

mpl.figure.prototype.toolbar_button_onmouseover = function(tooltip) {
    this.message.textContent = tooltip;
};

module.exports = mpl;
