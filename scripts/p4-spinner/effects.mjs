import { CENTER, SIZE, segmentAngles, segmentPath } from "./geometry.mjs";

function svgDocument(content, defs = "") {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}"`,
    ` height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    defs ? `<defs>${defs}</defs>` : "",
    content,
    "</svg>",
  ].join("");
}

export function glowSvg() {
  const defs = [
    `<radialGradient id="ambient-glow">`,
    `<stop offset="0" stop-color="#a79df2" stop-opacity=".2"/>`,
    `<stop offset=".56" stop-color="#c6b9ff" stop-opacity=".16"/>`,
    `<stop offset="1" stop-color="#f0a8cd" stop-opacity="0"/>`,
    "</radialGradient>",
    `<filter id="soft-glow" x="-30%" y="-30%" width="160%"`,
    ` height="160%"><feGaussianBlur stdDeviation="30"/></filter>`,
  ].join("");

  const content = [
    `<circle cx="${CENTER}" cy="${CENTER}" r="445"`,
    ` fill="url(#ambient-glow)" filter="url(#soft-glow)"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="428" fill="none"`,
    ` stroke="#8a82e8" stroke-opacity=".13" stroke-width="18"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="447" fill="none"`,
    ` stroke="#f0a7c8" stroke-opacity=".1" stroke-width="4"/>`,
  ].join("");

  return svgDocument(content, defs);
}

export function particlesSvg() {
  const particles = [
    [170, 182, 9, "#f39047", ".9"],
    [276, 104, 6, "#fff", ".88"],
    [420, 72, 5, "#8a82e8", ".72"],
    [658, 80, 7, "#ef9dc2", ".8"],
    [818, 180, 8, "#f39047", ".84"],
    [910, 316, 5, "#fff", ".82"],
    [940, 512, 7, "#8a82e8", ".74"],
    [878, 710, 6, "#ef9dc2", ".86"],
    [742, 860, 8, "#f39047", ".78"],
    [520, 930, 5, "#fff", ".78"],
    [284, 878, 7, "#8a82e8", ".78"],
    [112, 704, 6, "#ef9dc2", ".82"],
    [84, 486, 8, "#f39047", ".76"],
    [115, 302, 5, "#fff", ".84"],
  ];

  const particleMarkup = particles.map(([x, y, size, color, opacity], index) => {
    if (index % 3 === 0) {
      return `<path d="M${x} ${y - size} L${x + size} ${y}` +
        ` L${x} ${y + size} L${x - size} ${y} Z"` +
        ` fill="${color}" fill-opacity="${opacity}"/>`;
    }

    return `<circle cx="${x}" cy="${y}" r="${size / 2}"` +
      ` fill="${color}" fill-opacity="${opacity}"/>`;
  }).join("");

  const content = [
    particleMarkup,
    `<g fill="none" stroke="#fff" stroke-linecap="round">`,
    `<path d="M214 342 V382 M194 362 H234" stroke-opacity=".8"`,
    ` stroke-width="5"/>`,
    `<path d="M806 564 V608 M784 586 H828" stroke-opacity=".68"`,
    ` stroke-width="5"/>`,
    `<path d="M774 222 V248 M761 235 H787" stroke-opacity=".62"`,
    ` stroke-width="4"/>`,
    "</g>",
  ].join("");

  return svgDocument(content);
}

export function winGlowSvg() {
  const { startAngle, endAngle } = segmentAngles(0);
  const defs = [
    `<radialGradient id="win-flare" cx="50%" cy="50%">`,
    `<stop offset="0" stop-color="#fff" stop-opacity=".9"/>`,
    `<stop offset=".42" stop-color="#ffd2dc" stop-opacity=".48"/>`,
    `<stop offset="1" stop-color="#ffd2dc" stop-opacity="0"/>`,
    "</radialGradient>",
    `<filter id="win-blur" x="-50%" y="-50%" width="200%"`,
    ` height="200%"><feGaussianBlur stdDeviation="18"/></filter>`,
  ].join("");

  const content = [
    `<path d="${segmentPath(startAngle, endAngle, 414, 126)}"`,
    ` fill="#fff" fill-opacity=".25" stroke="#fff"`,
    ` stroke-opacity=".9" stroke-width="8"/>`,
    `<circle cx="512" cy="109" r="58" fill="url(#win-flare)"`,
    ` filter="url(#win-blur)"/>`,
    `<g fill="none" stroke="#fff" stroke-linecap="round">`,
    `<path d="M512 64 V24 M492 44 H532" stroke-width="8"`,
    ` stroke-opacity=".96"/>`,
    `<path d="M433 117 L409 93 M433 93 L409 117" stroke-width="6"`,
    ` stroke-opacity=".86"/>`,
    `<path d="M591 117 L615 93 M591 93 L615 117" stroke-width="6"`,
    ` stroke-opacity=".86"/>`,
    "</g>",
  ].join("");

  return svgDocument(content, defs);
}

export function shadowSvg() {
  const defs = `<filter id="ground-blur" x="-30%" y="-80%" width="160%"` +
    ` height="260%"><feGaussianBlur stdDeviation="18"/></filter>`;
  const content = `<ellipse cx="${CENTER}" cy="882" rx="330" ry="38"` +
    ` fill="#4435a2" fill-opacity=".18" filter="url(#ground-blur)"/>`;

  return svgDocument(content, defs);
}

