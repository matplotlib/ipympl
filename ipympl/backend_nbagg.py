"""Interactive figures in the Jupyter notebook"""

from base64 import b64encode
import json
import io

import numpy as np

from IPython.display import display, HTML

from ipywidgets import DOMWidget, widget_serialization
from traitlets import (
    Unicode, Bool, CInt, Float, List, Instance, CaselessStrEnum, Enum,
    default
)

import matplotlib
from matplotlib import rcParams
from matplotlib import is_interactive
from matplotlib.backends.backend_webagg_core import (FigureManagerWebAgg,
                                                     FigureCanvasWebAggCore,
                                                     NavigationToolbar2WebAgg,
                                                     TimerTornado)
from matplotlib.backend_bases import NavigationToolbar2, cursors, _Backend
from matplotlib._pylab_helpers import Gcf

from ._version import js_semver

cursors_str = {
    cursors.HAND: 'pointer',
    cursors.POINTER: 'default',
    cursors.SELECT_REGION: 'crosshair',
    cursors.MOVE: 'move',
    cursors.WAIT: 'wait'
}


def connection_info():
    """
    Return a string showing the figure and connection status for
    the backend. This is intended as a diagnostic tool, and not for general
    use.

    """
    from matplotlib._pylab_helpers import Gcf
    result = []
    for manager in Gcf.get_all_fig_managers():
        fig = manager.canvas.figure
        result.append('{0} - {1}'.format((fig.get_label() or
                                          "Figure {}".format(manager.num)),
                                         manager.web_sockets))
    if not is_interactive():
        result.append('Figures pending show: {0}'.format(len(Gcf._activeQue)))
    return '\n'.join(result)


class Toolbar(DOMWidget, NavigationToolbar2WebAgg):

    _model_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _model_module_version = Unicode(js_semver).tag(sync=True)
    _model_name = Unicode('ToolbarModel').tag(sync=True)

    _view_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _view_module_version = Unicode(js_semver).tag(sync=True)
    _view_name = Unicode('ToolbarView').tag(sync=True)

    toolitems = List().tag(sync=True)
    orientation = Enum(['horizontal', 'vertical'],
                       default_value='vertical').tag(sync=True)
    button_style = CaselessStrEnum(
        values=['primary', 'success', 'info', 'warning', 'danger', ''],
        default_value='',
        help="""Use a predefined styling for the button.""").tag(sync=True)
    collapsed = Bool(True).tag(sync=True)

    _current_action = Enum(values=['pan', 'zoom', ''],
                           default_value='').tag(sync=True)

    def __init__(self, canvas, *args, **kwargs):
        DOMWidget.__init__(self, *args, **kwargs)
        NavigationToolbar2WebAgg.__init__(self, canvas, *args, **kwargs)

        self.on_msg(self.canvas._handle_message)

    def export(self):
        buf = io.BytesIO()
        self.canvas.figure.savefig(buf, format='png', dpi='figure')
        data = "<img src='data:image/png;base64,{0}'/>"
        data = data.format(b64encode(buf.getvalue()).decode('utf-8'))
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
            'export': 'file-picture-o'
        }

        download_item = ('Download', 'Download plot', 'download',
                         'save_figure')

        toolitems = (NavigationToolbar2.toolitems + (download_item,))

        return [(text, tooltip, icons[icon_name], method_name)
                for text, tooltip, icon_name, method_name
                in toolitems
                if icon_name in icons]


class Canvas(DOMWidget, FigureCanvasWebAggCore):

    _model_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _model_module_version = Unicode(js_semver).tag(sync=True)
    _model_name = Unicode('MPLCanvasModel').tag(sync=True)

    _view_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _view_module_version = Unicode(js_semver).tag(sync=True)
    _view_name = Unicode('MPLCanvasView').tag(sync=True)

    toolbar = Instance(Toolbar,
                       allow_none=True).tag(sync=True, **widget_serialization)
    toolbar_visible = Bool(True).tag(sync=True)
    toolbar_position = Enum(['top', 'bottom', 'left', 'right'],
                            default_value='left').tag(sync=True)

    header_visible = Bool(True).tag(sync=True)
    footer_visible = Bool(True).tag(sync=True)

    resizable = Bool(True).tag(sync=True)
    capture_scroll = Bool(False).tag(sync=True)

    _width = CInt().tag(sync=True)
    _height = CInt().tag(sync=True)

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

        self._display_requested = False
        self._displayed_once = False

        self._has_data = False

    def _handle_message(self, object, content, buffers):
        # Every content has a "type".
        if content['type'] == 'closing':
            self._closed = True
        elif content['type'] == 'initialized':
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
            self._cursor = cursors_str[content['cursor']]

        elif content['type'] == 'message':
            self._message = content['message']

        elif content['type'] == 'figure_label':
            self._figure_label = content['label']

        elif content['type'] == 'resize':
            self._width = content['size'][0]
            self._height = content['size'][1]
            # Send resize message anyway
            self.send({'data': json.dumps(content)})

        elif content['type'] == 'image_mode':
            self._image_mode = content['mode']

        else:
            # Default: send the message to the front-end
            self.send({'data': json.dumps(content)})

    def send_binary(self, data):
        if not self._has_data:
            renderer = self.get_renderer()

            buff = (np.frombuffer(renderer.buffer_rgba(), dtype=np.uint32)
                    .reshape((renderer.height, renderer.width)))

            # If any pixels have transparency, we need to force a full
            # draw as we cannot overlay new on top of old.
            pixels = buff.view(dtype=np.uint8).reshape(buff.shape + (4,))

            if np.any(pixels[:, :, :2] != 255):
                self._has_data = True

        if (self._has_data and self._display_requested
                and not self._displayed_once):
            display(
                self._repr_mimebundle_(**self._display_requested_kwargs),
                raw=True, display_id='matplotlib_{0}'.format(self._model_id)
            )

            self._display_requested = False
            self._displayed_once = True

        self.send({'data': '{"type": "binary"}'}, buffers=[data])

    def new_timer(self, *args, **kwargs):
        return TimerTornado(*args, **kwargs)

    def force_initialize(self):
        self._handle_message(
            self,
            {
                'type': 'set_dpi_ratio', 'dpi_ratio': Canvas.current_dpi_ratio
            },
            []
        )
        self._handle_message(self, {'type': 'send_image_mode'}, [])
        self._handle_message(self, {'type': 'refresh'}, [])
        self._handle_message(self, {'type': 'initialized'}, [])
        self._handle_message(self, {'type': 'draw'}, [])

    def _repr_mimebundle_(self, **kwargs):
        # now happens before the actual display call.
        if hasattr(self, '_handle_displayed'):
            self._handle_displayed(**kwargs)
        plaintext = repr(self)
        if len(plaintext) > 110:
            plaintext = plaintext[:110] + '…'

        buf = io.BytesIO()
        self.figure.savefig(buf, format='png', dpi='figure')
        data_url = b64encode(buf.getvalue()).decode('utf-8')

        data = {
            'text/plain': plaintext,
            'image/png': data_url,
            'application/vnd.jupyter.widget-view+json': {
                'version_major': 2,
                'version_minor': 0,
                'model_id': self._model_id
            }
        }

        return data

    def _ipython_display_(self, **kwargs):
        """Called when `IPython.display.display` is called on a widget."""
        # We defer the first display if we don't have any plot data yet
        if not self._displayed_once and not self._has_data:
            self._display_requested = True
            self._display_requested_kwargs = kwargs
        else:
            display(
                self._repr_mimebundle_(**kwargs),
                raw=True, display_id='matplotlib_{0}'.format(self._model_id)
            )

    if matplotlib.__version__ < '3.4':
        # backport the Python side changes to match the js changes
        def _handle_key(self, event):
            _SPECIAL_KEYS_LUT = {'Alt': 'alt',
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
                                 'F12': 'f12'}

            def handle_key(key):
                """Handle key values"""
                value = key[key.index('k') + 1:]
                if 'shift+' in key:
                    if len(value) == 1:
                        key = key.replace('shift+', '')
                if value in _SPECIAL_KEYS_LUT:
                    value = _SPECIAL_KEYS_LUT[value]
                key = key[:key.index('k')] + value
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
    ToolbarCls = Toolbar

    def __init__(self, canvas, num):
        FigureManagerWebAgg.__init__(self, canvas, num)
        self.web_sockets = [self.canvas]

    def show(self):
        if self.canvas._closed:
            self.canvas._closed = False
            display(
                self.canvas,
                display_id='matplotlib_{0}'.format(self.canvas._model_id)
            )
        else:
            self.canvas.draw_idle()

    def destroy(self):
        self.canvas.close()


@_Backend.export
class _Backend_ipympl(_Backend):
    FigureCanvas = Canvas
    FigureManager = FigureManager

    @staticmethod
    def new_figure_manager_given_figure(num, figure):
        canvas = Canvas(figure)
        if 'nbagg.transparent' in rcParams and rcParams['nbagg.transparent']:
            figure.patch.set_alpha(0)
        manager = FigureManager(canvas, num)

        canvas.force_initialize()

        if is_interactive():
            manager.show()
            figure.canvas.draw_idle()

        def destroy(event):
            canvas.mpl_disconnect(cid)
            Gcf.destroy(manager)

        cid = canvas.mpl_connect('close_event', destroy)
        return manager

    @staticmethod
    def show(block=None):
        # TODO: something to do when keyword block==False ?

        managers = Gcf.get_all_fig_managers()
        if not managers:
            return

        interactive = is_interactive()

        for manager in managers:
            manager.show()

            # plt.figure adds an event which makes the figure in focus the
            # active one. Disable this behaviour, as it results in
            # figures being put as the active figure after they have been
            # shown, even in non-interactive mode.
            if hasattr(manager, '_cidgcf'):
                manager.canvas.mpl_disconnect(manager._cidgcf)

            if not interactive:
                Gcf.figs.pop(manager.num, None)
