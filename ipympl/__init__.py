from ._version import version_info, __version__

npm_pkg_name = 'jupyter-matplotlib'

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': npm_pkg_name,
        'require': npm_pkg_name + '/extension'
    }]

def _jupyter_labextension_paths():
    return [{
        'name': npm_pkg_name,
        'src': 'staticlab'
    }]

import matplotlib

matplotlib.use('module://ipympl.backend_nbagg')
