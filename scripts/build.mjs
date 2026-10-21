import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { Script } from "node:vm";

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? sourceFiles(`${dir}/${e.name}`)
          : /\.(js|css)$/.test(e.name)
            ? [`${dir}/${e.name}`]
            : [],
      ),
    )
  ).flat();
}
const sources = [
  "index.html",
  ...(await sourceFiles("assets/js")).filter((p) => !p.includes("/vendor/")),
  ...(await sourceFiles("assets/css")),
  ...(await sourceFiles("api")),
  ...(await sourceFiles("server")),
];
for (const file of sources) {
  const source = await readFile(file, "utf8");
  if (/voyagencash\.com/i.test(source))
    throw new Error(`Nom de marque incorrect dans ${file}`);
  if (/\p{Emoji_Presentation}|\uFE0F/gu.test(source))
    throw new Error(`Émoji interdit dans ${file}`);
  if (file.endsWith(".js")) new Script(source, { filename: file });
}
const html = await readFile("index.html", "utf8");
const symbols = new Set(
  [...html.matchAll(/<symbol id="(i-[^"]+)"/g)].map((match) => match[1]),
);
for (const match of html.matchAll(/<use href="#(i-[^"]+)"/g)) {
  if (!symbols.has(match[1]))
    throw new Error(`Symbole SVG absent : ${match[1]}`);
}
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g)) {
  await readFile("." + match[1]);
}
for (const file of sources.filter((p) => p.endsWith(".css"))) {
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(/url\(['"]?(\/assets\/[^)'"#]+)['"]?\)/g))
    await readFile("." + match[1]);
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("assets", "dist/assets", { recursive: true });
console.log(
  "voyagencash : sources et ressources vérifiées, production générée dans dist/",
);
