import matplotlib.pyplot as plt
import numpy as np

N = 6000
arr = np.random.rand(N, N)
fig, ax = plt.subplots()
ax.imshow(arr)
plt.savefig('large-image.png', dpi=500)
