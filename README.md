jupyter-matplotlib
==================

[![Version](https://img.shields.io/pypi/v/ipympl.svg)](https://pypi.python.org/pypi/ipympl)
[![Downloads](https://img.shields.io/pypi/dm/ipympl.svg)](https://pypi.python.org/pypi/ipympl)
[![Join the chat at https://gitter.im/ipython/ipywidgets](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ipython/ipywidgets?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Matplotlib Jupyter Extension.

This repository contains code for the Matplotlib Jupyter widget, stripped out
of the main matplotlib repository.

It requires matplotlib 2.0 or and ipywidgets 7.0 more recent.

The goal of this project is to separate development of the Jupyter integration
(future versions of notebook and Jupyter Lab) from the calendar of the releases
of the main matplotlib repository.

Example:

```python
%matplotlib widget
import matplotlib.pyplot as plt

plt.plot([0, 1, 2, 2])
plt.show()
```


Installation
------------

To install `ipympl` with conda:

    $ conda install -c conda-forge ipympl
    $ # If using the Notebook
    $ conda install -c conda-forge widgetsnbextension
    $ # If using JupyterLab
    $ conda install nodejs
    $ jupyter labextension install @jupyter-widgets/jupyterlab-manager


To install `ipympl` with pip:

    $ pip install ipympl
    $ # If using the Notebook
    $ jupyter nbextension enable --py --sys-prefix ipympl    # can be skipped for notebook version 5.3 and above
    $ # If using JupyterLab
    $ # Install nodejs: https://nodejs.org/en/download/
    $ jupyter labextension install @jupyter-widgets/jupyterlab-manager


For a development installation (requires node),

    $ git clone https://github.com/matplotlib/jupyter-matplotlib.git
    $ cd jupyter-matplotlib
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix ipympl
    $ jupyter nbextension enable --py --sys-prefix ipympl
    $ jupyter labextension install @jupyter-widgets/jupyterlab-manager --no-build
    $ jupyter labextension link ./js
    $ cd js && npm run watch
    $ # Launch jupyterlab as `jupyter lab --watch` in another terminal
