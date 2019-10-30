// Equivalent of jQuery offset method
function offset(el) {
    var boundingRect = el.getBoundingClientRect();
    return {
        top: boundingRect.top + document.body.scrollTop,
        left: boundingRect.left + document.body.scrollLeft
    }
};

// from http://stackoverflow.com/questions/1114465/getting-mouse-location-in-canvas
function get_mouse_position(e) {
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

    // offset() returns the position of the element relative to the document
    var targ_offset = offset(targ);
    var x = e.pageX - targ_offset.left;
    var y = e.pageY - targ_offset.top;

    return {'x': x, 'y': y};
};

/*
 * return a copy of an object with only non-object keys
 * we need this to avoid circular references
 * http://stackoverflow.com/a/24161582/3208463
 */
function get_simple_keys(original) {
    return Object.keys(original).reduce(function (obj, key) {
        if (typeof original[key] !== 'object')
            obj[key] = original[key]
        return obj;
    }, {});
}

/*
 * Return the total size of the margins for an element in both width and height.
 */
function get_margin_size(el) {
    var style = getComputedStyle(el);

    var margin_width = parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    var margin_height = parseFloat(style.marginTop) + parseFloat(style.marginBottom);

    return {
        width: margin_width,
        height: margin_height,
    };
}


/*
 * Return the full size of an element, including margins.
 */
function get_full_size(el) {
    var margin_size = get_margin_size(el);

    var full_width = el.scrollWidth + margin_size.width;
    var full_height = el.scrollHeight + margin_size.height;

    return {
        width: full_width,
        height: full_height,
    };
}

module.exports = {
  offset: offset,
  get_mouse_position: get_mouse_position,
  get_simple_keys: get_simple_keys,
  get_margin_size: get_margin_size,
  get_full_size: get_full_size,
}
