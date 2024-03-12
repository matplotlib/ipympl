"""Interactive figures in the Jupyter notebook"""

import sys
import types
from warnings import warn

# In the case of a pyodide context (JupyterLite)
# we mock Tornado, as it cannot be imported and would
# lead to errors. Of course, any code using tornado cannot
# work with this workaround, we prefer a half-working
# solution than a non-working solution here.
try:
    import micropip  # noqa

    sys.modules['tornado'] = types.ModuleType('tornadofake')
except ModuleNotFoundError:
    pass

import io
import json
from base64 import b64encode

try:
    from collections.abc import Iterable
except ImportError:
    # Python 2.7
    from collections import Iterable

import matplotlib
import numpy as np
from IPython import get_ipython
from IPython import version_info as ipython_version_info
from IPython.display import HTML, display
from ipython_genutils.py3compat import string_types
from ipywidgets import DOMWidget, widget_serialization
from matplotlib import is_interactive, rcParams
from matplotlib._pylab_helpers import Gcf
from matplotlib.backend_bases import NavigationToolbar2, _Backend, cursors
from matplotlib.backends.backend_webagg_core import (
    FigureCanvasWebAggCore,
    FigureManagerWebAgg,
    NavigationToolbar2WebAgg,
    TimerTornado,
)
from PIL import Image
from traitlets import (
    Any,
    Bool,
    CaselessStrEnum,
    CInt,
    Enum,
    Float,
    Instance,
    List,
    Tuple,
    Unicode,
    default,
    observe,
)

from ._version import js_semver

cursors_str = {
    cursors.HAND: 'pointer',
    cursors.POINTER: 'default',
    cursors.SELECT_REGION: 'crosshair',
    cursors.MOVE: 'move',
    cursors.WAIT: 'wait',
}


def connection_info():
    """
    Return a string showing the figure and connection status for
    the backend. This is intended as a diagnostic tool, and not for general
    use.

    """
    result = []
    for manager in Gcf.get_all_fig_managers():
        fig = manager.canvas.figure
        result.append(
            '{} - {}'.format(
                (fig.get_label() or f"Figure {manager.num}"),
                manager.web_sockets,
            )
        )
    if not is_interactive():
        result.append(f'Figures pending show: {len(Gcf._activeQue)}')
    return '\n'.join(result)


class Toolbar(DOMWidget, NavigationToolbar2WebAgg):

    _model_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _model_module_version = Unicode(js_semver).tag(sync=True)
    _model_name = Unicode('ToolbarModel').tag(sync=True)

    _view_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _view_module_version = Unicode(js_semver).tag(sync=True)
    _view_name = Unicode('ToolbarView').tag(sync=True)

    toolitems = List().tag(sync=True)
    button_style = CaselessStrEnum(
        values=['primary', 'success', 'info', 'warning', 'danger', ''],
        default_value='',
        help="""Use a predefined styling for the button.""",
    ).tag(sync=True)

    #######
    # Those traits are deprecated
    orientation = Enum(['horizontal', 'vertical'], default_value='vertical').tag(
        sync=True
    )
    collapsed = Bool(True).tag(sync=True)
    #######

    _current_action = Enum(values=['pan', 'zoom', ''], default_value='').tag(sync=True)

    def __init__(self, canvas, *args, **kwargs):
        DOMWidget.__init__(self, *args, **kwargs)
        NavigationToolbar2WebAgg.__init__(self, canvas, *args, **kwargs)

        self.on_msg(self.canvas._handle_message)

    def export(self):
        buf = io.BytesIO()
        self.canvas.figure.savefig(buf, format='png', dpi='figure')
        # Figure width in pixels
        pwidth = self.canvas.figure.get_figwidth() * self.canvas.figure.get_dpi()
        # Scale size to match widget on HiDPI monitors.
        if hasattr(self.canvas, 'device_pixel_ratio'):  # Matplotlib 3.5+
            width = pwidth / self.canvas.device_pixel_ratio
        else:
            width = pwidth / self.canvas._dpi_ratio
        data = "<img src='data:image/png;base64,{0}' width={1}/>"
        data = data.format(b64encode(buf.getvalue()).decode('utf-8'), width)
        display(HTML(data))

    @default('toolitems')
    def _default_toolitems(self):
        icons = {
            'home': 'home',
            'back': 'arrow-left',
            'forward': 'arrow-right',
            'zoom_to_rect': 'square-o',
            'move': 'arrows',
            'download': 'floppy-o',
            'export': 'file-picture-o',
        }

        download_item = ('Download', 'Download plot', 'download', 'save_figure')

        toolitems = NavigationToolbar2.toolitems + (download_item,)

        return [
            (text, tooltip, icons[icon_name], method_name)
            for text, tooltip, icon_name, method_name in toolitems
            if icon_name in icons
        ]

    def __getattr__(self, name):
        if name in ['orientation', 'collapsed']:
            warn(
                "The Toolbar properties 'orientation' and 'collapsed' are deprecated."
                "Accessing them will raise an error in a coming ipympl release",
                DeprecationWarning,
            )

        return super().__getattr__(name)

    @observe('orientation', 'collapsed')
    def _on_orientation_collapsed_changed(self, change):
        warn(
            "The Toolbar properties 'orientation' and 'collapsed' are deprecated.",
            DeprecationWarning,
        )


class Canvas(DOMWidget, FigureCanvasWebAggCore):

    _model_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _model_module_version = Unicode(js_semver).tag(sync=True)
    _model_name = Unicode('MPLCanvasModel').tag(sync=True)

    _view_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _view_module_version = Unicode(js_semver).tag(sync=True)
    _view_name = Unicode('MPLCanvasView').tag(sync=True)

    toolbar = Instance(Toolbar, allow_none=True).tag(sync=True, **widget_serialization)
    toolbar_visible = Enum(
        ['visible', 'hidden', 'fade-in-fade-out', True, False],
        default_value='fade-in-fade-out',
    ).tag(sync=True)
    toolbar_position = Enum(
        ['top', 'bottom', 'left', 'right'], default_value='left'
    ).tag(sync=True)

    header_visible = Bool(True).tag(sync=True)
    footer_visible = Bool(True).tag(sync=True)

    resizable = Bool(True).tag(sync=True)
    capture_scroll = Bool(False).tag(sync=True)
    pan_zoom_throttle = Float(33).tag(sync=True)

    # This is a very special widget trait:
    # We set "sync=True" because we want ipywidgets to consider this
    # as part of the widget state, but we overwrite send_state so that
    # it never sync the value with the front-end, the front-end keeps its
    # own value.
    # This will still be used by ipywidgets in the case of embedding.
    _data_url = Any(None).tag(sync=True)

    _size = Tuple([0, 0]).tag(sync=True)

    _figure_label = Unicode('Figure').tag(sync=True)
    _message = Unicode().tag(sync=True)
    _cursor = Unicode('pointer').tag(sync=True)

    _image_mode = Unicode('full').tag(sync=True)

    _rubberband_x = CInt(0).tag(sync=True)
    _rubberband_y = CInt(0).tag(sync=True)
    _rubberband_width = CInt(0).tag(sync=True)
    _rubberband_height = CInt(0).tag(sync=True)

    _closed = Bool(True)

    # Must declare the superclass private members.
    _png_is_old = Bool()
    _force_full = Bool()
    _current_image_mode = Unicode()

    # Static as it should be the same for all canvases
    current_dpi_ratio = 1.0

    def __init__(self, figure, *args, **kwargs):
        DOMWidget.__init__(self, *args, **kwargs)
        FigureCanvasWebAggCore.__init__(self, figure, *args, **kwargs)

        self.on_msg(self._handle_message)

        # This will stay True for cases where there is no
        # front-end (e.g. nbconvert --execute)
        self.syncing_data_url = True

    # Overwrite ipywidgets's send_state so we don't sync the data_url
    def send_state(self, key=None):
        if key is None:
            keys = self.keys
        elif isinstance(key, string_types):
            keys = [key]
        elif isinstance(key, Iterable):
            keys = key

        if not self.syncing_data_url:
            keys = [k for k in keys if k != '_data_url']

        DOMWidget.send_state(self, key=keys)

    def _handle_message(self, object, content, buffers):
        # Every content has a "type".
        if content['type'] == 'closing':
            self._closed = True

        elif content['type'] == 'initialized':
            # We stop syncing data url, the front-end is there and
            # ready to receive diffs
            self.syncing_data_url = False

            _, _, w, h = self.figure.bbox.bounds
            self.manager.resize(w, h)

        elif content['type'] == 'set_dpi_ratio':
            Canvas.current_dpi_ratio = content['dpi_ratio']
            self.manager.handle_json(content)

        else:
            self.manager.handle_json(content)

    def send_json(self, content):
        # Change in the widget state?
        if content['type'] == 'cursor':
            cursor = content['cursor']
            self._cursor = cursors_str[cursor] if cursor in cursors_str else cursor

        elif content['type'] == 'message':
            self._message = content['message']

        elif content['type'] == 'figure_label':
            self._figure_label = content['label']

        elif content['type'] == 'resize':
            self._size = content['size']
            # Send resize message anyway:
            # We absolutely need this instead of a `_size` trait change listening
            # on the front-end, otherwise ipywidgets might squash multiple changes
            # and the resizing protocol is not respected anymore
            self.send({'data': json.dumps(content)})

        elif content['type'] == 'image_mode':
            self._image_mode = content['mode']

        else:
            # Default: send the message to the front-end
            self.send({'data': json.dumps(content)})

    def send_binary(self, data):
        # TODO we should maybe rework the FigureCanvasWebAggCore implementation
        # so that it has a "refresh" method that we can overwrite

        # Update _data_url
        if self.syncing_data_url:
            data = self._last_buff.view(dtype=np.uint8).reshape(
                (*self._last_buff.shape, 4)
            )
            with io.BytesIO() as png:
                Image.fromarray(data).save(png, format="png")
                self._data_url = b64encode(png.getvalue()).decode('utf-8')

        # Actually send the data
        self.send({'data': '{"type": "binary"}'}, buffers=[data])

    def new_timer(self, *args, **kwargs):
        return TimerTornado(*args, **kwargs)

    def _repr_mimebundle_(self, **kwargs):
        # now happens before the actual display call.
        if hasattr(self, '_handle_displayed'):
            self._handle_displayed(**kwargs)
        plaintext = repr(self)
        if len(plaintext) > 110:
            plaintext = plaintext[:110] + '…'

        buf = io.BytesIO()
        self.figure.savefig(buf, format='png', dpi='figure')

        base64_image = b64encode(buf.getvalue()).decode('utf-8')
        self._data_url = f'data:image/png;base64,{base64_image}'
        # Figure size in pixels
        pwidth = self.figure.get_figwidth() * self.figure.get_dpi()
        pheight = self.figure.get_figheight() * self.figure.get_dpi()
        # Scale size to match widget on HiDPI monitors.
        if hasattr(self, 'device_pixel_ratio'):  # Matplotlib 3.5+
            width = pwidth / self.device_pixel_ratio
            height = pheight / self.device_pixel_ratio
        else:
            width = pwidth / self._dpi_ratio
            height = pheight / self._dpi_ratio
        html = """
            <div style="display: inline-block;">
                <div class="jupyter-widgets widget-label" style="text-align: center;">
                    {}
                </div>
                <img src='{}' width={}/>
            </div>
        """.format(
            self._figure_label, self._data_url, width
        )

        # Update the widget model properly for HTML embedding
        self._size = (width, height)

        data = {
            'text/plain': plaintext,
            'image/png': base64_image,
            'text/html': html,
            'application/vnd.jupyter.widget-view+json': {
                'version_major': 2,
                'version_minor': 0,
                'model_id': self._model_id,
            },
        }

        return data

    def _ipython_display_(self, **kwargs):
        """Called when `IPython.display.display` is called on a widget.
        Note: if we are in IPython 6.1 or later, we return NotImplemented so
        that _repr_mimebundle_ is used directly.
        """
        if ipython_version_info >= (6, 1):
            raise NotImplementedError

        data = self._repr_mimebundle_(**kwargs)
        display(data, raw=True)

    if matplotlib.__version__ < '3.4':
        # backport the Python side changes to match the js changes
        def _handle_key(self, event):
            _SPECIAL_KEYS_LUT = {
                'Alt': 'alt',
                'AltGraph': 'alt',
                'CapsLock': 'caps_lock',
                'Control': 'control',
                'Meta': 'meta',
                'NumLock': 'num_lock',
                'ScrollLock': 'scroll_lock',
                'Shift': 'shift',
                'Super': 'super',
                'Enter': 'enter',
                'Tab': 'tab',
                'ArrowDown': 'down',
                'ArrowLeft': 'left',
                'ArrowRight': 'right',
                'ArrowUp': 'up',
                'End': 'end',
                'Home': 'home',
                'PageDown': 'pagedown',
                'PageUp': 'pageup',
                'Backspace': 'backspace',
                'Delete': 'delete',
                'Insert': 'insert',
                'Escape': 'escape',
                'Pause': 'pause',
                'Select': 'select',
                'Dead': 'dead',
                'F1': 'f1',
                'F2': 'f2',
                'F3': 'f3',
                'F4': 'f4',
                'F5': 'f5',
                'F6': 'f6',
                'F7': 'f7',
                'F8': 'f8',
                'F9': 'f9',
                'F10': 'f10',
                'F11': 'f11',
                'F12': 'f12',
            }

            def handle_key(key):
                """Handle key values"""
                value = key[key.index('k') + 1 :]
                if 'shift+' in key:
                    if len(value) == 1:
                        key = key.replace('shift+', '')
                if value in _SPECIAL_KEYS_LUT:
                    value = _SPECIAL_KEYS_LUT[value]
                key = key[: key.index('k')] + value
                return key

            key = handle_key(event['key'])
            e_type = event['type']
            guiEvent = event.get('guiEvent', None)
            if e_type == 'key_press':
                self.key_press_event(key, guiEvent=guiEvent)
            elif e_type == 'key_release':
                self.key_release_event(key, guiEvent=guiEvent)

        handle_key_press = handle_key_release = _handle_key


class FigureManager(FigureManagerWebAgg):
    if matplotlib.__version__ < "3.6":
        ToolbarCls = Toolbar

    def __init__(self, canvas, num):
        FigureManagerWebAgg.__init__(self, canvas, num)
        self.web_sockets = [self.canvas]
        self.toolbar = Toolbar(self.canvas)

    def show(self):
        if self.canvas._closed:
            self.canvas._closed = False
            display(self.canvas)
        else:
            self.canvas.draw_idle()

    def destroy(self):
        self.canvas.close()


@_Backend.export
class _Backend_ipympl(_Backend):
    FigureCanvas = Canvas
    FigureManager = FigureManager

    _to_show = []
    _draw_called = False

    @staticmethod
    def new_figure_manager_given_figure(num, figure):
        canvas = Canvas(figure)
        if 'nbagg.transparent' in rcParams and rcParams['nbagg.transparent']:
            figure.patch.set_alpha(0)
        manager = FigureManager(canvas, num)

        if is_interactive():
            _Backend_ipympl._to_show.append(figure)
            figure.canvas.draw_idle()

        def destroy(event):
            canvas.mpl_disconnect(cid)
            Gcf.destroy(manager)

        cid = canvas.mpl_connect('close_event', destroy)

        # Only register figure for showing when in interactive mode (otherwise
        # we'll generate duplicate plots, since a user who set ioff() manually
        # expects to make separate draw/show calls).
        if is_interactive():
            # ensure current figure will be drawn.
            try:
                _Backend_ipympl._to_show.remove(figure)
            except ValueError:
                # ensure it only appears in the draw list once
                pass
            # Queue up the figure for drawing in next show() call
            _Backend_ipympl._to_show.append(figure)
            _Backend_ipympl._draw_called = True

        return manager

    @staticmethod
    def show(block=None):
        # # TODO: something to do when keyword block==False ?
        interactive = is_interactive()

        manager = Gcf.get_active()
        if manager is None:
            return

        try:
            display(manager.canvas)
            # metadata=_fetch_figure_metadata(manager.canvas.figure)

            # plt.figure adds an event which makes the figure in focus the
            # active one. Disable this behaviour, as it results in
            # figures being put as the active figure after they have been
            # shown, even in non-interactive mode.
            if hasattr(manager, '_cidgcf'):
                manager.canvas.mpl_disconnect(manager._cidgcf)

            if not interactive:
                Gcf.figs.pop(manager.num, None)
        finally:
            if manager.canvas.figure in _Backend_ipympl._to_show:
                _Backend_ipympl._to_show.remove(manager.canvas.figure)


def flush_figures():
    backend = matplotlib.get_backend()
    if backend in ('widget', 'ipympl', 'module://ipympl.backend_nbagg'):
        if not _Backend_ipympl._draw_called:
            return

        try:
            # exclude any figures that were closed:
            active = {fm.canvas.figure for fm in Gcf.get_all_fig_managers()}

            for fig in [fig for fig in _Backend_ipympl._to_show if fig in active]:
                # display(fig.canvas, metadata=_fetch_figure_metadata(fig))
                display(fig.canvas)
        finally:
            # clear flags for next round
            _Backend_ipympl._to_show = []
            _Backend_ipympl._draw_called = False


ip = get_ipython()
if ip is not None:
    ip.events.register('post_execute', flush_figures)
