"""Tests for download functionality respecting rcParams."""

import io
import json
from unittest.mock import MagicMock, patch

import matplotlib
import matplotlib.pyplot as plt
import pytest


def test_send_save_buffer_respects_format():
    """Test that _send_save_buffer respects savefig.format rcParam."""
    matplotlib.use('module://ipympl.backend_nbagg')

    # Test PNG format (default)
    plt.rcParams['savefig.format'] = 'png'
    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    canvas._send_save_buffer()

    # Verify send was called
    assert canvas.send.called
    call_args = canvas.send.call_args

    # Check message format
    msg_data = json.loads(call_args[0][0]['data'])
    assert msg_data['type'] == 'save'
    assert msg_data['format'] == 'png'

    # Check buffer is not empty
    buffers = call_args[1]['buffers']
    assert len(buffers) == 1
    assert len(buffers[0]) > 0

    plt.close(fig)


def test_send_save_buffer_respects_pdf_format():
    """Test that _send_save_buffer respects PDF format."""
    matplotlib.use('module://ipympl.backend_nbagg')

    plt.rcParams['savefig.format'] = 'pdf'
    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    canvas._send_save_buffer()

    call_args = canvas.send.call_args
    msg_data = json.loads(call_args[0][0]['data'])
    assert msg_data['format'] == 'pdf'

    # Verify buffer starts with PDF signature
    buffers = call_args[1]['buffers']
    assert buffers[0][:4] == b'%PDF'

    plt.close(fig)


def test_send_save_buffer_respects_svg_format():
    """Test that _send_save_buffer respects SVG format."""
    matplotlib.use('module://ipympl.backend_nbagg')

    plt.rcParams['savefig.format'] = 'svg'
    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    canvas._send_save_buffer()

    call_args = canvas.send.call_args
    msg_data = json.loads(call_args[0][0]['data'])
    assert msg_data['format'] == 'svg'

    # Verify buffer contains SVG content
    buffers = call_args[1]['buffers']
    buffer_str = buffers[0].decode('utf-8')
    assert '<?xml' in buffer_str or '<svg' in buffer_str

    plt.close(fig)


def test_download_method_calls_send_save_buffer():
    """Test that download() method calls _send_save_buffer()."""
    matplotlib.use('module://ipympl.backend_nbagg')

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas

    # Mock _send_save_buffer
    with patch.object(canvas, '_send_save_buffer') as mock_send:
        canvas.download()
        mock_send.assert_called_once()

    plt.close(fig)


def test_toolbar_save_figure_calls_send_save_buffer():
    """Test that Toolbar.save_figure() calls canvas._send_save_buffer()."""
    matplotlib.use('module://ipympl.backend_nbagg')

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    toolbar = canvas.toolbar

    # Mock _send_save_buffer
    with patch.object(canvas, '_send_save_buffer') as mock_send:
        toolbar.save_figure()
        mock_send.assert_called_once()

    plt.close(fig)


def test_send_save_buffer_respects_dpi():
    """Test that _send_save_buffer respects savefig.dpi rcParam."""
    matplotlib.use('module://ipympl.backend_nbagg')

    # Test with high DPI
    plt.rcParams['savefig.format'] = 'png'
    plt.rcParams['savefig.dpi'] = 300

    fig, ax = plt.subplots(figsize=(2, 2))
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    canvas._send_save_buffer()

    # Get buffer size with high DPI
    call_args = canvas.send.call_args
    high_dpi_size = len(call_args[1]['buffers'][0])

    plt.close(fig)

    # Test with low DPI
    plt.rcParams['savefig.dpi'] = 50

    fig2, ax2 = plt.subplots(figsize=(2, 2))
    ax2.plot([1, 2, 3], [1, 4, 2])

    canvas2 = fig2.canvas
    canvas2.send = MagicMock()

    canvas2._send_save_buffer()

    # Get buffer size with low DPI
    call_args2 = canvas2.send.call_args
    low_dpi_size = len(call_args2[1]['buffers'][0])

    plt.close(fig2)

    # High DPI should produce larger file
    assert high_dpi_size > low_dpi_size


def test_send_save_buffer_respects_transparent():
    """Test that _send_save_buffer respects savefig.transparent rcParam."""
    matplotlib.use('module://ipympl.backend_nbagg')

    plt.rcParams['savefig.format'] = 'png'
    plt.rcParams['savefig.transparent'] = True

    fig, ax = plt.subplots()
    fig.patch.set_facecolor('red')
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    canvas._send_save_buffer()

    # Verify buffer was created (checking actual transparency would require PIL)
    call_args = canvas.send.call_args
    buffers = call_args[1]['buffers']
    assert len(buffers[0]) > 0

    plt.close(fig)


def test_send_save_buffer_with_pgf_format():
    """Test that _send_save_buffer works with PGF format."""
    matplotlib.use('module://ipympl.backend_nbagg')

    # Test with PGF format (LaTeX graphics format)
    plt.rcParams['savefig.format'] = 'pgf'

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 2])

    canvas = fig.canvas
    canvas.send = MagicMock()

    # Should work without warnings
    canvas._send_save_buffer()

    # Should send the buffer with format='pgf'
    assert canvas.send.called
    call_args = canvas.send.call_args
    assert 'data' in call_args[0][0]
    import json
    msg_data = json.loads(call_args[0][0]['data'])
    assert msg_data['format'] == 'pgf'

    plt.close(fig)
