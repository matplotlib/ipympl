jupyter-matplotlib
==================

Matplotlib Jupyter Extension.

This repository contains code for the Matplotlib Jupyter widget, stripped out
of the main matplotlib repository.

It depends on the current development version of matplotlib itself.

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
    $ jupyter nbextension install --py --symlink --user ipympl
    $ jupyter nbextension enable --py --user ipympl
