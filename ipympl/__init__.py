from ._version import version_info, __version__


def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'jupyter-matplotlib',
        'require': 'jupyter-matplotlib/extension'
    }]

import matplotlib

matplotlib.use('module://ipympl.backend_nbagg')
