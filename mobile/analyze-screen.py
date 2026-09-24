from PIL import Image
from collections import Counter
image = Image.open('phase4-white-screen.png').convert('RGB')
colors = Counter(image.getdata())
print('size', image.size)
print('top_colors', colors.most_common(12))
print('corners', [image.getpixel(point) for point in [(0,0),(10,10),(image.width-1,10),(10,image.height-1),(image.width-1,image.height-1)]])
