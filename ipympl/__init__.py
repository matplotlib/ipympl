import sys
import matplotlib
from ._version import version_info, __version__

npm_pkg_name = 'jupyter-matplotlib'


def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': npm_pkg_name,
        'require': npm_pkg_name + '/extension'
    }]


# Ensure that `widget` is not selected as the backend name by IPython,
# which causes a UsageError.
if 'IPython' in sys.modules:
    from IPython.core.pylabtools import backend2gui
    backend2gui['module://ipympl.backend_nbagg'] = 'ipympl'

matplotlib.use('module://ipympl.backend_nbagg')
