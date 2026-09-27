import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  layerSvg,
} from "./spinner-assets/layers.mjs";
import { GAME_SEGMENTS } from "./spinner-assets/icons.mjs";
import { CENTER, SIZE } from "./spinner-assets/geometry.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputDirectory = join(
  projectRoot,
  "public",
  "assets",
  "member",
  "spinner",
);

function loadSharp() {
  try {
    return createRequire(import.meta.url)("sharp");
  } catch {
    const pnpmDirectory = join(projectRoot, "node_modules", ".pnpm");
    const packageName = readdir(pnpmDirectory, { withFileTypes: true })
      .then((entries) =>
        entries.find(
          (entry) => entry.isDirectory() && entry.name.startsWith("sharp@"),
        ),
      );

    return packageName.then((entry) => {
      if (!entry) {
        throw new Error(
          "sharp is required to rasterize the spinner SVG layers.",
        );
      }

      const packageJson = join(
        pnpmDirectory,
        entry.name,
        "node_modules",
        "sharp",
        "package.json",
      );

      return createRequire(packageJson)("sharp");
    });
  }
}

function previewSvg(title, subtitle) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1320"`,
    ` height="1220" viewBox="0 0 1320 1220">`,
    `<defs>`,
    `<radialGradient id="preview-lilac" cx="0" cy="0">`,
    `<stop offset="0" stop-color="#d2c4f7" stop-opacity=".92"/>`,
    `<stop offset="1" stop-color="#d2c4f7" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<radialGradient id="preview-pink" cx="1" cy=".55">`,
    `<stop offset="0" stop-color="#ffddea" stop-opacity=".86"/>`,
    `<stop offset="1" stop-color="#ffddea" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="1320" height="1220" fill="#eff2fd"/>`,
    `<circle cx="0" cy="0" r="520" fill="url(#preview-lilac)"/>`,
    `<circle cx="1320" cy="630" r="470" fill="url(#preview-pink)"/>`,
    `<text x="660" y="58" text-anchor="middle" fill="#171a99"`,
    ` font-family="Arial, sans-serif" font-size="25" font-weight="800"`,
    ` letter-spacing="3">${title}</text>`,
    `<text x="660" y="88" text-anchor="middle" fill="#4a4a9c"`,
    ` font-family="Arial, sans-serif" font-size="15">${subtitle}</text>`,
    `<rect x="147" y="112" width="1026" height="1026" rx="42"`,
    ` fill="#fff" fill-opacity=".22" stroke="#fff"`,
    ` stroke-opacity=".65" stroke-width="2"/>`,
    `</svg>`,
  ].join("");
}

function heroSvg(withBackground = false) {
  const background = withBackground
    ? `<linearGradient id="hero-base" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#171a55"/>` +
      `<stop offset=".54" stop-color="#2b2a88"/>` +
      `<stop offset="1" stop-color="#ef9dc2"/>` +
      `</linearGradient>`
    : "";
  const fill = withBackground
    ? `<rect width="1600" height="720" fill="url(#hero-base)"/>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600"`,
    ` height="720" viewBox="0 0 1600 720">`,
    `<defs>${background}`,
    `<radialGradient id="hero-halo">`,
    `<stop offset="0" stop-color="#d5ceff" stop-opacity=".42"/>`,
    `<stop offset=".7" stop-color="#8a82e8" stop-opacity=".13"/>`,
    `<stop offset="1" stop-color="#8a82e8" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    fill,
    `<ellipse cx="1190" cy="365" rx="425" ry="410"`,
    ` fill="url(#hero-halo)"/>`,
    `<path d="M690 582 C828 194 1177 35 1538 173" fill="none"`,
    ` stroke="#fff" stroke-opacity=".22" stroke-width="3"/>`,
    `<path d="M748 657 C915 300 1228 161 1580 259" fill="none"`,
    ` stroke="#f7b8d2" stroke-opacity=".26" stroke-width="6"/>`,
    `<path d="M884 158 L900 174 L884 190 L868 174 Z"`,
    ` fill="#f39047" fill-opacity=".9"/>`,
    `<path d="M728 314 L737 323 L728 332 L719 323 Z"`,
    ` fill="#fff" fill-opacity=".84"/>`,
    `</svg>`,
  ].join("");
}

async function renderLayer(sharp, name, svg) {
  const svgPath = join(outputDirectory, `spinner-${name}.svg`);
  const pngPath = join(outputDirectory, `spinner-${name}.png`);
  const buffer = Buffer.from(svg);

  await writeFile(svgPath, svg, "utf8");
  await sharp(buffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(pngPath);

  return { name, svgPath, pngPath, buffer };
}

async function renderPreview(sharp, layers, filename, title, subtitle) {
  const background = Buffer.from(previewSvg(title, subtitle));
  const composite = layers.map(({ buffer }) => ({
    input: buffer,
    left: 148,
    top: 112,
  }));
  const outputPath = join(outputDirectory, filename);

  await sharp(background).composite(composite).png({
    compressionLevel: 9,
    adaptiveFiltering: true,
  }).toFile(outputPath);
}

async function renderHeroAssets(sharp, layers) {
  const stageSize = 720;
  const left = 850;
  const top = 0;
  const layerNames = [
    "shadow",
    "glow",
    "frame",
    "selector",
    "pointer",
    "particles",
    "button",
  ];
  const composite = [];

  for (const name of layerNames) {
    const layer = layers.find((entry) => entry.name === name);
    if (!layer) continue;

    const input = await sharp(layer.buffer)
      .resize(stageSize, stageSize)
      .png()
      .toBuffer();
    composite.push({ input, left, top });
  }

  await sharp(Buffer.from(heroSvg(false)))
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(outputDirectory, "spinner-hero-art.png"));

  await sharp(Buffer.from(heroSvg(true)))
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(outputDirectory, "spinner-hero-banner.png"));
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const sharp = await loadSharp();
  const layerOrder = [
    "shadow",
    "glow",
    "frame",
    "selector",
    "pointer",
    "button",
    "particles",
  ];
  const layerEntries = Object.entries(layerSvg);
  const renderedLayers = [];

  for (const [name, createSvg] of layerEntries) {
    renderedLayers.push(await renderLayer(sharp, name, createSvg()));
  }

  const byName = new Map(
    renderedLayers.map((layer) => [layer.name, layer]),
  );
  const idleLayers = layerOrder.map((name) => byName.get(name));
  const winLayers = [...idleLayers, byName.get("win-glow")];
  const manifestLayerOrder = [...layerOrder, "win-glow"];

  await renderPreview(
    sharp,
    idleLayers,
    "spinner-preview.png",
    "GAME SPIN",
    "Idle composition · 8-game selector · transparent layers",
  );
  await renderPreview(
    sharp,
    winLayers,
    "spinner-preview-win.png",
    "GAME SPIN",
    "Win-state composition · fixed pointer target highlight",
  );
  await renderHeroAssets(sharp, renderedLayers);

  const manifest = {
    package: "game-spinner",
    canvas: {
      width: SIZE,
      height: SIZE,
      pivot: { x: CENTER, y: CENTER },
    },
    selector: {
      segmentCount: 8,
      pointerAngle: -90,
      initialWinningCenterAngle: -90,
      direction: "clockwise",
      targetOffset: 0,
      games: GAME_SEGMENTS.map(({ id, name }) => ({ id, name })),
    },
    layerOrder,
    layers: manifestLayerOrder.map((name) => ({
      name,
      svg: `spinner-${name}.svg`,
      png: `spinner-${name}.png`,
      transparent: true,
      animatedByFrontend: [
        "selector",
        "button",
        "glow",
        "particles",
        "win-glow",
      ].includes(name),
    })),
    previews: [
      "spinner-preview.png",
      "spinner-preview-win.png",
    ],
    hero: {
      foreground: "spinner-hero-art.png",
      banner: "spinner-hero-banner.png",
      copySafeArea: "left 44%",
    },
    generator: "scripts/generate-spinner-assets.mjs",
    generatedAt: new Date().toISOString(),
  };

  await writeFile(
    join(outputDirectory, "spinner-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  if (!existsSync(join(outputDirectory, "spinner-frame.png"))) {
    throw new Error("Spinner PNG output was not created.");
  }

  console.log(
    `Generated ${renderedLayers.length} spinner layers in ${outputDirectory}`,
  );
}

await main();
