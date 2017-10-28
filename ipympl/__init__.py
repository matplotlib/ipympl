from ._version import version_info, __version__

npm_pkg_name = 'jupyter-matplotlib'

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': npm_pkg_name,
        'require': npm_pkg_name + '/extension'
    }]

import matplotlib

matplotlib.use('module://ipympl.backend_nbagg')
