import sys

from ._version import __version__, version_info  # noqa

npm_pkg_name = 'jupyter-matplotlib'


def _jupyter_labextension_paths():
    return [{'src': 'labextension', 'dest': npm_pkg_name}]


def _jupyter_nbextension_paths():
    return [
        {
            'section': 'notebook',
            'src': 'nbextension',
            'dest': npm_pkg_name,
            'require': npm_pkg_name + '/extension',
        }
    ]


# __init__.py is used by the nbextension installation.
# Conda cannot have dependencies for post-link scripts.
if 'matplotlib' in sys.modules:
    import matplotlib

    matplotlib.use('module://ipympl.backend_nbagg')
