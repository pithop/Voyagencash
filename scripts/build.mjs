import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { Script } from 'node:vm';

const scripts = ['flight-engine', 'booking-manager', 'app'];
const sources = ['index.html', 'assets/css/style.css', ...scripts.map(name => `assets/js/${name}.js`)];
for (const file of sources) {
  const source = await readFile(file, 'utf8');
  if (/voyagencash\.com/i.test(source)) throw new Error(`Nom de marque incorrect dans ${file}`);
  if (/\p{Emoji_Presentation}|\uFE0F/gu.test(source)) throw new Error(`Émoji interdit dans ${file}`);
  if (file.endsWith('.js')) new Script(source, { filename: file });
}
const html = await readFile('index.html', 'utf8');
const symbols = new Set([...html.matchAll(/<symbol id="(i-[^"]+)"/g)].map(match => match[1]));
for (const match of html.matchAll(/<use href="#(i-[^"]+)"/g)) {
  if (!symbols.has(match[1])) throw new Error(`Symbole SVG absent : ${match[1]}`);
}
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g)) {
  await readFile('.' + match[1]);
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('assets', 'dist/assets', { recursive: true });
console.log('voyagencash : sources et ressources vérifiées, production générée dans dist/');
