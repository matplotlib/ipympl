"""Interactive figures in the Jupyter notebook"""

from base64 import b64encode
import json
import io
import six
import os
from uuid import uuid4 as uuid

from IPython.display import display, HTML

from ipywidgets import DOMWidget
from traitlets import Unicode, Bool, Float, List, Any

from matplotlib import rcParams
from matplotlib.figure import Figure
from matplotlib import is_interactive
from matplotlib.backends.backend_webagg_core import (FigureManagerWebAgg,
                                                     FigureCanvasWebAggCore,
                                                     NavigationToolbar2WebAgg,
                                                     TimerTornado)
from matplotlib.backend_bases import (ShowBase, NavigationToolbar2,
                                      FigureCanvasBase)


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


# Note: Version 3.2 and 4.x icons
# http://fontawesome.io/3.2.1/icons/
# http://fontawesome.io/
# the `fa fa-xxx` part targets font-awesome 4, (IPython 3.x)
# the icon-xxx targets font awesome 3.21 (IPython 2.x)
_FONT_AWESOME_CLASSES = {
    'home': 'fa fa-home icon-home',
    'back': 'fa fa-arrow-left icon-arrow-left',
    'forward': 'fa fa-arrow-right icon-arrow-right',
    'zoom_to_rect': 'fa fa-square-o icon-check-empty',
    'move': 'fa fa-arrows icon-move',
    'download': 'fa fa-floppy-o icon-save',
    'export': 'fa fa-file-picture-o icon-picture',
    None: None
}


class NavigationIPy(NavigationToolbar2WebAgg):

    # Use the standard toolbar items + download button
    toolitems = [(text, tooltip_text,
                  _FONT_AWESOME_CLASSES[image_file], name_of_method)
                 for text, tooltip_text, image_file, name_of_method
                 in (NavigationToolbar2.toolitems +
                     (('Download', 'Download plot', 'download', 'download'),))
                 if image_file in _FONT_AWESOME_CLASSES]

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


here = os.path.dirname(__file__)
with open(os.path.join(here, 'static', 'package.json')) as fid:
    js_version = json.load(fid)['version']


class FigureCanvasNbAgg(DOMWidget, FigureCanvasWebAggCore):

    _model_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _model_module_version = Unicode('^%s' % js_version).tag(sync=True)
    _model_name = Unicode('MPLCanvasModel').tag(sync=True)

    _view_module = Unicode('jupyter-matplotlib').tag(sync=True)
    _view_module_version = Unicode('^%s' % js_version).tag(sync=True)
    _view_name = Unicode('MPLCanvasView').tag(sync=True)

    _toolbar_items = List().tag(sync=True)
    _closed = Bool(True)
    _id = Unicode('').tag(sync=True)

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
    _is_idle_drawing = Bool()

    def __init__(self, figure, *args, **kwargs):
        super(FigureCanvasWebAggCore, self).__init__(figure, *args, **kwargs)
        super(DOMWidget, self).__init__(*args, **kwargs)
        self._uid = uuid().hex
        self.on_msg(self._handle_message)

    def _handle_message(self, object, message, buffers):
        # The 'supports_binary' message is relevant to the
        # websocket itself.  The other messages get passed along
        # to matplotlib as-is.

        # Every message has a "type" and a "figure_id".
        message = json.loads(message)
        if message['type'] == 'closing':
            self._closed = True
        elif message['type'] == 'supports_binary':
            self.supports_binary = message['value']
        elif message['type'] == 'initialized':
            _, _, w, h = self.figure.bbox.bounds
            self.manager.resize(w, h)
            self.send_json('refresh')
        else:
            self.manager.handle_json(message)

    def send_json(self, content):
        self.send({'data': json.dumps(content)})

    def send_binary(self, blob):
        # The comm is ascii, so we always send the image in base64
        # encoded data URL form.
        data = b64encode(blob)
        if six.PY3:
            data = data.decode('ascii')
        data_uri = "data:image/png;base64,{0}".format(data)
        self.send({'data': data_uri})

    def new_timer(self, *args, **kwargs):
        return TimerTornado(*args, **kwargs)

    def start_event_loop(self, timeout):
        FigureCanvasBase.start_event_loop_default(self, timeout)

    def stop_event_loop(self):
        FigureCanvasBase.stop_event_loop_default(self)


class FigureManagerNbAgg(FigureManagerWebAgg):
    ToolbarCls = NavigationIPy

    def __init__(self, canvas, num):
        FigureManagerWebAgg.__init__(self, canvas, num)
        toolitems = []
        for name, tooltip, image, method in self.ToolbarCls.toolitems:
            if name is None:
                toolitems.append(['', '', '', ''])
            else:
                toolitems.append([name, tooltip, image, method])
        canvas._toolbar_items = toolitems
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

    canvas = FigureCanvasNbAgg(figure)
    if 'nbagg.transparent' in set(rcParams.keys()) and rcParams['nbagg.transparent']:
        figure.patch.set_alpha(0)
    manager = FigureManagerNbAgg(canvas, num)

    if is_interactive():
        manager.show()
        figure.canvas.draw_idle()

    canvas.mpl_connect('close_event', closer)

    return manager
