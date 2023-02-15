# Installing

In most cases all you need to do is
```bash
pip install ipympl
```
or alternatively with `mamba`/`conda`

```bash
mamba install -c conda-forge ipympl
```

and then restart Jupyter.


### Jupyterlab < 3
If you use JupyterLab 2, you still need to install the labextension manually:

```bash
conda install -c conda-forge nodejs
jupyter labextension install @jupyter-widgets/jupyterlab-manager jupyter-matplotlib
```


<!--
## Sagemath CoCalc
TODO
-->

### Google Colab

To use `ipympl` in colab run these lines:

```python
from google.colab import output
output.enable_custom_widget_manager()
```

## Mixing Frontend and Backend Versions

`ipympl` provides both a Frontend (in javascript) which handles displaying the plots and handling interaction events, as well as a backend (in Python) that renders the plots and interfaces with user code. These two parts need to be able to communicate with each other for everything to work. In the most common situation that your frontend and backend are from the same Python environment then installing `ipympl` should have given you compatible versions.

However, there are situations when you may have different versions of ipympl in the frontend and the backend. In this case you need to ensure that you have compatible versions of the frontend and backend. For details and an initial compatibility table see the discussion on this [Github issue](https://github.com/matplotlib/ipympl/issues/416).


## Compatibility Table

Not all versions of `ipympl` are compatible with different version of Jupyterlab or all versions of Matplotlib. The below table provides a reference for which versions are compatible.

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
