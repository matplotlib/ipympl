"""
Test programmatic download using fig.canvas.download()

This demonstrates the new public API for triggering downloads from Python code
without clicking the toolbar button.
"""

# This would be run in a Jupyter notebook with %matplotlib ipympl
import matplotlib
matplotlib.use('module://ipympl.backend_nbagg')

import matplotlib.pyplot as plt
import numpy as np

# Example 1: Simple programmatic download
print("Example 1: Simple download")
fig, ax = plt.subplots()
ax.plot([1, 2, 3], [1, 4, 2])
ax.set_title('Programmatic Download Test')

# Trigger download programmatically - no button click needed!
fig.canvas.download()
print("  -> Downloads as PNG (default format)")

# Example 2: Download as PDF
print("\nExample 2: Download as PDF")
plt.rcParams['savefig.format'] = 'pdf'

fig, ax = plt.subplots()
ax.plot(np.linspace(0, 10, 100), np.sin(np.linspace(0, 10, 100)))
ax.set_title('PDF Download')

fig.canvas.download()
print("  -> Downloads as PDF")

# Example 3: Batch download multiple figures
print("\nExample 3: Batch download 3 figures")
plt.rcParams['savefig.format'] = 'png'

for i in range(3):
    fig, ax = plt.subplots()
    ax.plot(np.random.randn(50))
    ax.set_title(f'Figure {i+1}')
    fig.canvas.download()
    print(f"  -> Downloaded Figure {i+1}")

# Example 4: Download with custom settings
print("\nExample 4: Custom DPI and transparent background")
plt.rcParams['savefig.dpi'] = 150
plt.rcParams['savefig.transparent'] = True

fig, ax = plt.subplots()
ax.scatter(np.random.randn(100), np.random.randn(100))
ax.set_title('High-res Transparent')

fig.canvas.download()
print("  -> Downloads as 150 DPI PNG with transparent background")

print("\n✅ All programmatic downloads triggered!")
print("Check your Downloads folder for the files.")
