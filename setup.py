from __future__ import print_function
from distutils import log
from setuptools import setup, find_packages
import os

from jupyter_packaging import (
    create_cmdclass,
    install_npm,
    ensure_targets,
    combine_commands,
    get_version,
)

# Name of the project
name = 'ipympl'

here = os.path.dirname(os.path.abspath(__file__))
long_description = 'Matplotlib Jupyter Extension'

log.info('setup.py entered')
log.info('$PATH=%s' % os.environ['PATH'])

# Get ipympl version
version = get_version(os.path.join(name, '_version.py'))

js_dir = os.path.join(here, 'js')

# Representative files that should exist after a successful build
jstargets = [
    os.path.join(js_dir, 'dist', 'index.js'),
]

data_files_spec = [
    ('share/jupyter/nbextensions/jupyter-matplotlib',
     'ipympl/nbextension', '**'),
    ('share/jupyter/labextensions/jupyter-matplotlib',
     'ipympl/labextension', "**"),
    ('etc/jupyter/nbconfig/notebook.d', '.', 'jupyter-matplotlib.json'),
]

cmdclass = create_cmdclass('jsdeps', data_files_spec=data_files_spec)
cmdclass['jsdeps'] = combine_commands(
    install_npm(js_dir, build_cmd='build'), ensure_targets(jstargets),
)

setup_args = dict(
    name=name,
    version=version,
    description='Matplotlib Jupyter Extension',
    long_description=long_description,
    license='BSD License',
    include_package_data=True,
    install_requires=[
        'ipykernel>=4.7',
        'ipywidgets>=7.5.0',
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
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)

setup(**setup_args)
