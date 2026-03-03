import os
from PIL import Image

image_dir = 'images'
for filename in os.listdir(image_dir):
    if filename.endswith('.png') or filename.endswith('.jpg'):
        filepath = os.path.join(image_dir, filename)
        img = Image.open(filepath)
        webp_filename = filename.rsplit('.', 1)[0] + '.webp'
        webp_filepath = os.path.join(image_dir, webp_filename)
        img.save(webp_filepath, 'webp', optimize=True, quality=80)
        print(f"Converted {filename} to {webp_filename}")
