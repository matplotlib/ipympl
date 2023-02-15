# ipympl

[![Test Status](https://github.com/matplotlib/ipympl/actions/workflows/main.yml/badge.svg)](https://github.com/matplotlib/ipympl/actions/workflows/main.yml?query=branch%3Amain)
[![Latest PyPI version](https://img.shields.io/pypi/v/ipympl?logo=pypi)](https://pypi.python.org/pypi/ipympl)
[![Latest conda-forge version](https://img.shields.io/conda/vn/conda-forge/ipympl?logo=conda-forge)](https://anaconda.org/conda-forge/ipympl)
[![Latest npm version](https://img.shields.io/npm/v/jupyter-matplotlib?logo=npm)](https://www.npmjs.com/package/jupyter-matplotlib)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/matplotlib/ipympl/stable?urlpath=retro/notebooks/docs/examples/full-example.ipynb)
[![Gitter](https://img.shields.io/badge/gitter-Join_chat-blue?logo=gitter)](https://gitter.im/jupyter-widgets/Lobby)

Leveraging the Jupyter interactive widgets framework, `ipympl` enables the interactive features of matplotlib in the Jupyter notebook and in JupyterLab.

Besides, the figure `canvas` element is a proper Jupyter interactive widget which can be positioned in interactive widget layouts.


## Usage

To enable the `ipympl` backend, simply use the `matplotlib` Jupyter
magic:

```
%matplotlib widget
```
## Documentation
See the documentation at: https://matplotlib.org/ipympl/
## Example
See the [example notebook](https://github.com/matplotlib/ipympl/blob/main/docs/examples/full-example.ipynb) for more!

![matplotlib screencast](matplotlib.gif)

## Installation

### With conda:

```bash
conda install -c conda-forge ipympl
```

### With pip:

```bash
pip install ipympl
```

### Use in JupyterLab

If you want to use ipympl in JupyterLab, we recommend using JupyterLab >= 3.

If you use JupyterLab 2, you still need to install the labextension manually:

```bash
conda install -c conda-forge nodejs
jupyter labextension install @jupyter-widgets/jupyterlab-manager jupyter-matplotlib
```

#### Install an old JupyterLab extension

If you are using JupyterLab 1 or 2, you will need to install the right `jupyter-matplotlib` version, according to the `ipympl` and `jupyterlab` versions you installed.
For example, if you installed ipympl `0.5.1`, you need to install jupyter-matplotlib `0.7.0`, and this version is only compatible with JupyterLab `1`.

```bash
conda install -c conda-forge ipympl==0.5.1
jupyter labextension install @jupyter-widgets/jupyterlab-manager jupyter-matplotlib@0.7.0
```

Versions lookup table:

| `ipympl` | `jupyter-matplotlib` | `JupyterLab` | `Matplotlib` |
|----------|----------------------|--------------|--------------|
| 0.9.3    | 0.11.3+              | 3 or 2       | 3.4.0>=      |
| 0.9.0-2  | 0.11.0-2             | 3 or 2       | 3.4.0>=  <3.7|
| 0.8.8    | 0.10.x               | 3 or 2       | 3.3.1>=  <3.7|
| 0.8.0-7  | 0.10.x               | 3 or 2       | 3.3.1>=, <3.6|
| 0.7.0    | 0.9.0                | 3 or 2       | 3.3.1>=      |
| 0.6.x    | 0.8.x                | 3 or 2       | 3.3.1>=, <3.4|
| 0.5.8    | 0.7.4                | 1 or 2       | 3.3.1>=, <3.4|
| 0.5.7    | 0.7.3                | 1 or 2       | 3.2.*        |
| ...      | ...                  | ...          |              |
| 0.5.3    | 0.7.2                | 1 or 2       |              |
| 0.5.2    | 0.7.1                | 1            |              |
| 0.5.1    | 0.7.0                | 1            |              |
| 0.5.0    | 0.6.0                | 1            |              |
| 0.4.0    | 0.5.0                | 1            |              |
| 0.3.3    | 0.4.2                | 1            |              |
| 0.3.2    | 0.4.1                | 1            |              |
| 0.3.1    | 0.4.0                | 0 or 1       |              |

### For a development installation (requires nodejs):

Create a dev environment that has nodejs installed. The instructions here use
[mamba](https://github.com/mamba-org/mamba#the-fast-cross-platform-package-manager) but you
can also use conda.

```bash
mamba env create --file dev-environment.yml
conda activate ipympl-dev
```

Install the Python Packge
```bash
pip install -e .
```

When developing your extensions, you need to manually enable your extensions with the
notebook / lab frontend. For lab, this is done by the command:

```bash
jupyter labextension develop --overwrite .
yarn run build
```

For classic notebook, you need to run:
```bash
jupyter nbextension install --py --symlink --sys-prefix --overwrite ipympl
jupyter nbextension enable --py --sys-prefix ipympl
```

#### How to see your changes

**Typescript**:

If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the widget.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn run watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

**Python:**

If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.
