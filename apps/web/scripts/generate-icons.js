const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function createIcon(size, filename) {
  const png = new PNG({ width: size, height: size });
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Background: dark gray (#111827)
      let r = 17, g = 24, b = 39;
      
      // Create a simple "B" letter shape in the center
      const cx = size / 2;
      const cy = size / 2;
      const w = size * 0.35;
      const h = size * 0.45;
      
      // Check if pixel is inside the "B" shape
      const dx = x - cx;
      const dy = y - cy;
      
      // Left vertical bar of B
      const inLeftBar = dx >= -w && dx < -w + size * 0.08 && dy >= -h && dy <= h;
      
      // Top horizontal bar
      const inTopBar = dy >= -h && dy < -h + size * 0.08 && dx >= -w && dx <= w * 0.6;
      
      // Middle horizontal bar
      const inMidBar = dy >= -size * 0.04 && dy < size * 0.04 && dx >= -w && dx <= w * 0.6;
      
      // Bottom horizontal bar
      const inBotBar = dy >= h - size * 0.08 && dy <= h && dx >= -w && dx <= w * 0.6;
      
      // Right top bump
      const inRightTop = dx > -w + size * 0.08 && dx <= w * 0.6 && dy >= -h && dy < -size * 0.04;
      
      // Right bottom bump
      const inRightBot = dx > -w + size * 0.08 && dx <= w * 0.6 && dy >= size * 0.04 && dy <= h;
      
      const inB = inLeftBar || inTopBar || inMidBar || inBotBar || inRightTop || inRightBot;
      
      if (inB) {
        // Cyan/teal color for the B (#06b6d4)
        r = 6; g = 182; b = 212;
      }
      
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  
  const buffer = PNG.sync.write(png);
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.writeFileSync(path.join(iconsDir, filename), buffer);
  console.log(`Created ${filename} (${size}x${size})`);
}

createIcon(72, 'icon-72.png');
createIcon(96, 'icon-96.png');
createIcon(128, 'icon-128.png');
createIcon(144, 'icon-144.png');
createIcon(152, 'icon-152.png');
createIcon(180, 'icon-180.png');
createIcon(192, 'icon-192.png');
createIcon(384, 'icon-384.png');
createIcon(512, 'icon-512.png');
console.log('All icons generated!');
