# Contributing

Thanks for thinking of a way to help improve this library! Remember that contributions come in all shapes and sizes beyond writing bug fixes. Contributing to [documentation](#documentation), opening new [issues](https://github.com/matplotlib/ipympl/issues) for bugs, asking for clarification on things you find unclear, and requesting new features, are all super valuable contributions.

## Code Improvements

All development for this library happens on GitHub [here](https://github.com/matplotlib/ipympl). We recommend you work with a [Conda](https://www.anaconda.com/products/individual) environment (or an alternative virtual environment like [`venv`](https://docs.python.org/3/library/venv.html)).

The below instructions use [Mamba](https://github.com/mamba-org/mamba#the-fast-cross-platform-package-manager) which is a very fast implementation of `conda`.

```bash
git clone <your fork>
cd ipympl
mamba env create --file dev-environment.yml
conda activate ipympl-dev
pre-commit install
```

Install the Python Packge
```bash
pip install -e .
```

When developing your extensions, you need to manually enable your extensions with the
notebook / lab frontend. For lab, this is done by the command:

```bash
jupyter labextension develop --overwrite .
jlpm build
```

For classic notebook, you need to run:
```bash
jupyter nbextension install --py --symlink --sys-prefix --overwrite ipympl
jupyter nbextension enable --py --sys-prefix ipympl
```



### How to see your changes

**Typescript**:

If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the widget.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

**Python:**

If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.


## Documentation

Our documentation is built with [Sphinx](https://www.sphinx-doc.org) from the notebooks in the `docs` folder. It contains both Markdown files and Jupyter notebooks.

Examples are best written as Jupyter notebooks. To write a new example, create in a notebook in the `docs/examples` directory and list its path under one of the [`toctree`s](https://www.sphinx-doc.org/en/master/usage/restructuredtext/directives.html#directive-toctree) in the `index.ipynb` file. When the docs are generated, they will be rendered as static html pages by [myst-nb](https://myst-nb.readthedocs.io).

If you have installed all developer dependencies (see [above](#contributing)), you can rebuild the docs with the following `make` command run from inside the `docs` folder:

```
make html
```

Then you can open the `_build/index.html` file in your browser you should now be able to see the rendered documentation.

Alternatively, you can use [sphinx-autobuild](https://github.com/executablebooks/sphinx-autobuild) to continuously watch source files for changes and rebuild the documentation for you. Sphinx-autobuild will be installed automatically in the dev environment you created earlier so all you need to do is run

```bash
make watch
```
from inside the `docs` folder

In a few seconds your web browser should open up the documentation. Now whenever you save a file the documentation will automatically regenerate and the webpage will refresh for you!

## Working with Git

Using Git/GitHub can confusing (<https://xkcd.com/1597>), so if you're new to Git, you may find it helpful to use a program like [GitHub Desktop](https://desktop.github.com) and to follow a [guide](https://github.com/firstcontributions/first-contributions#first-contributions).

Also feel free to ask for help/advice on the relevant GitHub [issue](https://github.com/matplotlib/ipympl/issues).


## Getting Help contributing

Feel free to ask questions about how to contribute on any Github Issue. You can also ask shorter questions on the [gitter chatroom](https://gitter.im/jupyter-widgets/Lobby).
