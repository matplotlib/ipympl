// Get mouse position relative to target
export function get_mouse_position(event: MouseEvent, targ: HTMLElement) {
    const boundingRect = targ.getBoundingClientRect();

    return {
        x: event.clientX - boundingRect.left,
        y: event.clientY - boundingRect.top,
    };
}

/*
 * return a copy of an object with only non-object keys
 * we need this to avoid circular references
 * http://stackoverflow.com/a/24161582/3208463
 */
export function get_simple_keys(original: any) {
    return Object.keys(original).reduce((obj: any, key) => {
        if (typeof original[key] !== 'object') {
            obj[key] = original[key];
        }
        return obj;
    }, {});
}

// taken from ipycanvas (https://github.com/martinRenou/ipycanvas)
// Helpful for getting a drawing context while avoiding typescript errors about a context
// possibly being null.
// https://github.com/martinRenou/ipycanvas/blob/8c91ec4f634ff3661f594872e8050cf27d6db0c6/src/widget.ts#L23-L29
export function getContext(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context === null) {
        throw 'Could not create 2d context.';
    }
    return context;
}
