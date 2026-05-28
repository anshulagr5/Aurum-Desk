const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { default: pngToIco } = require('png-to-ico');

const SOURCE_PNG = path.join(__dirname, '..', 'build', 'icon.png');
const OUTPUT_ICO = path.join(__dirname, '..', 'build', 'icon.ico');

// Standard Windows icon sizes. Include all common sizes for crisp rendering.
const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

// Padding percentage — adds a small transparent border so rounded corners
// don't touch the canvas edge, eliminating white anti-aliasing fringes.
const PADDING_PCT = 0.03;

async function generateIcons() {
  console.log('Reading source PNG:', SOURCE_PNG);

  const sourceBuffer = fs.readFileSync(SOURCE_PNG);
  const source = sharp(sourceBuffer);
  const metadata = await source.metadata();
  console.log(`Source: ${metadata.width}x${metadata.height}`);

  const pngBuffers = [];

  for (const size of SIZES) {
    const padding = Math.round(size * PADDING_PCT);
    const innerSize = size - padding * 2;

    // Resize to inner size, then embed on a transparent canvas of target size
    const resized = await source
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    const padded = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, gravity: 'center' }])
      .png()
      .toBuffer();

    pngBuffers.push(padded);
    console.log(`  Generated ${size}x${size} (padding: ${padding}px)`);
  }

  console.log('Combining into ICO...');
  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(OUTPUT_ICO, icoBuffer);

  const stats = fs.statSync(OUTPUT_ICO);
  console.log(`\nSuccess! Written ${OUTPUT_ICO}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`Contains ${SIZES.length} sizes: ${SIZES.join(', ')}`);
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

