from __future__ import print_function
from distutils import log
from setuptools import setup, find_packages
import os
from os.path import join as pjoin

from jupyter_packaging import (
    create_cmdclass,
    install_npm,
    ensure_targets,
    combine_commands,
    get_version,
    skip_if_exists
)

# Name of the project
name = 'ipympl'

HERE = os.path.dirname(os.path.abspath(__file__))
long_description = 'Matplotlib Jupyter Extension'

log.info('setup.py entered')
log.info('$PATH=%s' % os.environ['PATH'])

# Get ipympl version
version = get_version(os.path.join(name, '_version.py'))

js_dir = os.path.join(HERE, 'js')

# Representative files that should exist after a successful build
jstargets = [
    pjoin(HERE, name, 'nbextension', 'index.js'),
    pjoin(HERE, 'lib', 'plugin.js'),
]

data_files_spec = [
    ('share/jupyter/nbextensions/jupyter-matplotlib',
     'ipympl/nbextension', '**'),
    ('share/jupyter/labextensions/jupyter-matplotlib',
     'ipympl/labextension', "**"),
    ('etc/jupyter/nbconfig/notebook.d', '.', 'jupyter-matplotlib.json'),
]

cmdclass = create_cmdclass('jsdeps', data_files_spec=data_files_spec)
js_command = combine_commands(
    install_npm(HERE, npm=['yarn'], build_cmd='build:prod'),
    ensure_targets(jstargets),
)

is_repo = os.path.exists(os.path.join(HERE, '.git'))
if is_repo:
    cmdclass['jsdeps'] = js_command
else:
    cmdclass['jsdeps'] = skip_if_exists(jstargets, js_command)

setup_args = dict(
    name=name,
    version=version,
    description='Matplotlib Jupyter Extension',
    long_description=long_description,
    license='BSD License',
    include_package_data=True,
    install_requires=[
        'ipykernel>=4.7',
        'ipywidgets>=7.6.0',
        'matplotlib>=2.0.0'
    ],
    packages=find_packages(),
    zip_safe=False,
    cmdclass=cmdclass,
    author='Matplotlib Development Team',
    author_email='matplotlib-users@python.org',
    url='http://matplotlib.org',
    keywords=[
        'ipython',
        'jupyter',
        'widgets',
        'graphics',
    ],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Framework :: IPython',
        'Intended Audience :: Developers',
        'Intended Audience :: Science/Research',
        'Topic :: Multimedia :: Graphics',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
    ],
)

setup(**setup_args)
