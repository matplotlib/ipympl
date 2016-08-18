jupyter-matplotlib
==================

[![Version](https://img.shields.io/pypi/v/ipympl.svg)](https://pypi.python.org/pypi/ipympl)
[![Downloads](https://img.shields.io/pypi/dm/ipympl.svg)](https://pypi.python.org/pypi/ipympl)
[![Join the chat at https://gitter.im/ipython/ipywidgets](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ipython/ipywidgets?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Matplotlib Jupyter Extension.

This repository contains code for the Matplotlib Jupyter widget, stripped out
of the main matplotlib repository.

It requires matplotlib 2.0.0b3 or more recent.

The goal of this project is to separate developement of the Jupyter integration
(future versions of notebook and Jupyter Lab) from the calendar of the releases
of the main matplotlib repository.

Installation
------------

To install use pip:

    $ pip install ipympl
    $ jupyter nbextension enable --py --sys-prefix ipympl


For a development installation (requires npm),

    $ git clone https://github.com/matplotlib/jupyter-matplotlib.git
    $ cd jupyter-matplotlib
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix ipympl
    $ jupyter nbextension enable --py --sys-prefix ipympl
