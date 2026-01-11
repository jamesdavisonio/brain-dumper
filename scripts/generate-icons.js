import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Read the SVG
const svgPath = join(publicDir, 'icon-transparent.svg')
const svgContent = readFileSync(svgPath, 'utf8')

// Generate icons
const sizes = [192, 512]

async function generateIcons() {
  for (const size of sizes) {
    // Regular icon
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `icon-${size}.png`))

    console.log(`Generated icon-${size}.png`)

    // Maskable icon (with padding for safe zone)
    const padding = Math.floor(size * 0.1)
    const innerSize = size - padding * 2

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 78, g: 205, b: 196, alpha: 1 } // #4ECDC4
      }
    })
      .composite([
        {
          input: await sharp(Buffer.from(svgContent))
            .resize(innerSize, innerSize)
            .toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toFile(join(publicDir, `icon-${size}-maskable.png`))

    console.log(`Generated icon-${size}-maskable.png`)
  }

  console.log('All icons generated!')
}

generateIcons().catch(console.error)
