import warnings

import matplotlib


def test_toolbar_initialization_does_not_warn():
    """Toolbar initialization should not pass canvas through Traitlets."""
    matplotlib.use("module://ipympl.backend_nbagg")
    import matplotlib.pyplot as plt

    with warnings.catch_warnings():
        warnings.simplefilter("error", DeprecationWarning)
        fig, ax = plt.subplots()

    assert fig.canvas.toolbar is not None
    plt.close(fig)
