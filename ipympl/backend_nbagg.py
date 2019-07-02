"""Interactive figures in the Jupyter notebook"""

from base64 import b64encode
import json
import io
import os

from IPython.display import display, HTML

from ipywidgets import DOMWidget, widget_serialization
from traitlets import (
    Unicode, Bool, Float, List, Any, Instance, CaselessStrEnum, Enum,
    default
)

from matplotlib import rcParams
from matplotlib.figure import Figure
from matplotlib import is_interactive
from matplotlib.backends.backend_webagg_core import (FigureManagerWebAgg,
                                                     FigureCanvasWebAggCore,
                                                     NavigationToolbar2WebAgg,
                                                     TimerTornado)
from matplotlib.backend_bases import (ShowBase, NavigationToolbar2,
                                      FigureCanvasBase)

here = os.path.dirname(__file__)
with open(os.path.join(here, 'static', 'package.json')) as fid:
    js_semver = '^%s' % json.load(fid)['version']


class Show(ShowBase):

    def __call__(self, block=None):
        from matplotlib._pylab_helpers import Gcf

        managers = Gcf.get_all_fig_managers()
        if not managers:
            return

        interactive = is_interactive()

        for manager in managers:
            manager.show()

            # plt.figure adds an event which puts the figure in focus
            # in the activeQue. Disable this behaviour, as it results in
            # figures being put as the active figure after they have been
            # shown, even in non-interactive mode.
            if hasattr(manager, '_cidgcf'):
                manager.canvas.mpl_disconnect(manager._cidgcf)

            if not interactive and manager in Gcf._activeQue:
                Gcf._activeQue.remove(manager)

show = Show()

def draw_if_interactive():
    import matplotlib._pylab_helpers as pylab_helpers

    if is_interactive():
        manager = pylab_helpers.Gcf.get_active()
        if manager is not None:
            manager.show()

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
        result.append('{0} - {0}'.format((fig.get_label() or
                                          "Figure {0}".format(manager.num)),
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
    orientation = Enum(['horizontal', 'vertical'], default_value='vertical').tag(sync=True)
    button_style = CaselessStrEnum(
        values=['primary', 'success', 'info', 'warning', 'danger', ''], default_value='',
        help="""Use a predefined styling for the button.""").tag(sync=True)

    def __init__(self, canvas, *args, **kwargs):
        DOMWidget.__init__(self, *args, **kwargs)
        NavigationToolbar2WebAgg.__init__(self, canvas, *args, **kwargs)

        self.on_msg(self.canvas._handle_message)

    def export(self):
        buf = io.BytesIO()
        self.canvas.figure.savefig(buf, format='png', dpi='figure')
        # Figure width in pixels
        pwidth = self.canvas.figure.get_figwidth() * self.canvas.figure.get_dpi()
        # Scale size to match widget on HiPD monitors
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
            'export': 'file-picture-o'
        }

        download_item = ('Download', 'Download plot', 'download', 'save_figure')

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

    toolbar = Instance(Toolbar, allow_none=True).tag(sync=True, **widget_serialization)
    toolbar_visible = Bool(True).tag(sync=True)
    toolbar_position = Enum(['top', 'bottom', 'left', 'right'], default_value='left').tag(sync=True)
    _closed = Bool(True)

    # Must declare the superclass private members.
    _png_is_old = Bool()
    _force_full = Bool()
    _current_image_mode = Unicode()
    _dpi_ratio = Float(1.0)
    _is_idle_drawing = Bool()
    _is_saving = Bool()
    _button = Any()
    _key = Any()
    _lastx = Any()
    _lasty = Any()

    def __init__(self, figure, *args, **kwargs):
        DOMWidget.__init__(self, *args, **kwargs)
        FigureCanvasWebAggCore.__init__(self, figure, *args, **kwargs)

        self.on_msg(self._handle_message)

    def _handle_message(self, object, content, buffers):
        # Every content has a "type".
        if content['type'] == 'closing':
            self._closed = True
        elif content['type'] == 'initialized':
            _, _, w, h = self.figure.bbox.bounds
            self.manager.resize(w, h)
        else:
            self.manager.handle_json(content)

    def send_json(self, content):
        self.send({'data': json.dumps(content)})

    def send_binary(self, data):
        self.send({'data': '{"type": "binary"}'}, buffers=[data])

    def new_timer(self, *args, **kwargs):
        return TimerTornado(*args, **kwargs)

    def start_event_loop(self, timeout):
        FigureCanvasBase.start_event_loop_default(self, timeout)

    def stop_event_loop(self):
        FigureCanvasBase.stop_event_loop_default(self)


class FigureManager(FigureManagerWebAgg):
    ToolbarCls = Toolbar

    def __init__(self, canvas, num):
        FigureManagerWebAgg.__init__(self, canvas, num)
        self.web_sockets = [self.canvas]

    def show(self):
        if self.canvas._closed:
            self.canvas._closed = False
            display(self.canvas)
        else:
            self.canvas.draw_idle()

    def destroy(self):
        self.canvas.close()


def new_figure_manager(num, *args, **kwargs):
    """
    Create a new figure manager instance
    """
    FigureClass = kwargs.pop('FigureClass', Figure)
    thisFig = FigureClass(*args, **kwargs)
    return new_figure_manager_given_figure(num, thisFig)


def new_figure_manager_given_figure(num, figure):
    """
    Create a new figure manager instance for the given figure.
    """
    from matplotlib._pylab_helpers import Gcf

    def closer(event):
        Gcf.destroy(num)

    canvas = Canvas(figure)
    if 'nbagg.transparent' in set(rcParams.keys()) and rcParams['nbagg.transparent']:
        figure.patch.set_alpha(0)
    manager = FigureManager(canvas, num)

    if is_interactive():
        manager.show()
        figure.canvas.draw_idle()

    canvas.mpl_connect('close_event', closer)

    return manager
