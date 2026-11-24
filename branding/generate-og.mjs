/**
 * Generates public/og-default.png (1200x630 OpenGraph / Twitter social card)
 * from branding/og-card.svg. Run manually and commit the output; this is not
 * part of `pnpm build`.
 *
 *   node branding/generate-og.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const branding = dirname(fileURLToPath(import.meta.url));
const out = join(branding, '..', 'public', 'og-default.png');

await sharp(join(branding, 'og-card.svg'), { density: 96 })
	.resize(1200, 630)
	.png({ compressionLevel: 9 })
	.toFile(out);

console.log(`Generated ${out} (1200x630)`);
