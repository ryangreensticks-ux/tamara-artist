// Makes 600px and 1200px-wide WebP copies of every photo in images/, saved under _thumbs/<width>/.
// Run by the "Publish website" workflow; the site falls back to the original if a copy is missing.
import sharp from 'sharp';
import {readdir, mkdir} from 'node:fs/promises';
import {join, relative, dirname, extname} from 'node:path';

const root = process.argv[2] || process.cwd();
const SIZES = [600, 1200];
const PHOTO = /\.(jpe?g|png|webp)$/i;

async function* walk(dir) {
  for (const d of await readdir(dir, {withFileTypes: true})) {
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (PHOTO.test(d.name)) yield p;
  }
}

const jobs = [];
for await (const file of walk(join(root, 'images'))) jobs.push(file);

let done = 0, failed = 0;
const work = async file => {
  const rel = relative(root, file);
  for (const size of SIZES) {
    const out = join(root, '_thumbs', String(size), rel.slice(0, -extname(rel).length) + '.webp');
    await mkdir(dirname(out), {recursive: true});
    await sharp(file).rotate().resize({width: size, withoutEnlargement: true}).webp({quality: 80}).toFile(out);
  }
};
// a few at a time
const queue = [...jobs];
await Promise.all(Array.from({length: 4}, async () => {
  while (queue.length) {
    const f = queue.shift();
    try { await work(f); done++; } catch (e) { failed++; console.warn('Skipped', relative(root, f), '-', e.message); }
  }
}));
console.log(`Made smaller copies of ${done} photos` + (failed ? `, skipped ${failed}` : ''));
