// Get mouse position relative to target
export
function get_mouse_position(event, targ) {
    var boundingRect = targ.getBoundingClientRect();

    return {
        x: event.clientX - boundingRect.left,
        y: event.clientY - boundingRect.top
    };
};

/*
 * return a copy of an object with only non-object keys
 * we need this to avoid circular references
 * http://stackoverflow.com/a/24161582/3208463
 */
export
function get_simple_keys(original) {
    return Object.keys(original).reduce(function (obj, key) {
        if (typeof original[key] !== 'object')
            obj[key] = original[key]
        return obj;
    }, {});
}
