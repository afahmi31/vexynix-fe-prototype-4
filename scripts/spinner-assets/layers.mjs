import {
  CENTER,
  SIZE,
  iconPosition,
  polygonPath,
  polygonPoints,
  polarPoint,
  segmentPath,
} from "./geometry.mjs";
import { iconMarkup } from "./icons.mjs";
import {
  glowSvg,
  particlesSvg,
  shadowSvg,
  winGlowSvg,
} from "./effects.mjs";

const SEGMENT_COLORS = [
  ["#ffccd4", "#f3a8c6"],
  ["#d8d6ff", "#a89eed"],
  ["#ffe1d2", "#f6b59f"],
  ["#c8c5ff", "#8a82e8"],
  ["#f9d4e6", "#dca9e8"],
  ["#ddd9ff", "#aaa3f2"],
  ["#ffe5c8", "#f7b87c"],
  ["#d1d1ff", "#978feb"],
];

const FRAME_DOTS = [
  "#f39047",
  "#5b52df",
  "#ef9dc2",
  "#5b52df",
  "#f39047",
  "#5b52df",
  "#ef9dc2",
  "#5b52df",
];

function svgDocument(content, defs = "") {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}"`,
    ` height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    defs ? `<defs>${defs}</defs>` : "",
    content,
    "</svg>",
  ].join("");
}

function frameMounts() {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = -90 + index * 45;
    const point = polarPoint(455, angle);
    const dot = FRAME_DOTS[index];

    return [
      `<g transform="translate(${point.x.toFixed(2)} `,
      `${point.y.toFixed(2)}) rotate(${angle + 90})">`,
      `<rect x="-18" y="-7" width="36" height="14" rx="7"`,
      ` fill="#fff" fill-opacity=".74" stroke="#5b52df"`,
      ` stroke-opacity=".26" stroke-width="3"/>`,
      `<circle r="5" fill="${dot}"/>`,
      "</g>",
    ].join("");
  }).join("");
}

function selectorSegments() {
  return SEGMENT_COLORS.map(([start, end], index) => {
    const angle = 360 / SEGMENT_COLORS.length;
    const centerAngle = -90 + index * angle;
    const startAngle = centerAngle - angle / 2;
    const endAngle = centerAngle + angle / 2;
    const position = iconPosition(index);

    return [
      `<path d="${segmentPath(startAngle, endAngle)}"`,
      ` fill="url(#segment-${index})" stroke="#fff"`,
      ` stroke-opacity=".8" stroke-width="6"/>`,
      `<circle cx="${position.x.toFixed(2)}" cy="${position.y.toFixed(2)}"`,
      ` r="43" fill="#fff" fill-opacity=".27"`,
      ` stroke="#fff" stroke-opacity=".42" stroke-width="3"/>`,
      `<g transform="translate(${position.x.toFixed(2)} `,
      `${position.y.toFixed(2)})">${iconMarkup(index)}</g>`,
    ].join("");
  }).join("");
}

function selectorGradientDefs() {
  return SEGMENT_COLORS.map(([start, end], index) => [
    `<linearGradient id="segment-${index}" x1="0" y1="0"`,
    ` x2="1" y2="1">`,
    `<stop offset="0" stop-color="${start}"/>`,
    `<stop offset="1" stop-color="${end}"/>`,
    "</linearGradient>",
  ].join("")).join("");
}

export function frameSvg() {
  const defs = [
    `<linearGradient id="frame-surface" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#fff" stop-opacity=".9"/>`,
    `<stop offset=".5" stop-color="#d9dcff" stop-opacity=".42"/>`,
    `<stop offset="1" stop-color="#f6dce9" stop-opacity=".68"/>`,
    "</linearGradient>",
    `<filter id="frame-shadow" x="-20%" y="-20%" width="140%"`,
    ` height="150%">`,
    `<feDropShadow dx="0" dy="18" stdDeviation="18"`,
    ` flood-color="#5345b9" flood-opacity=".18"/>`,
    "</filter>",
  ].join("");

  const content = [
    `<g filter="url(#frame-shadow)">`,
    `<path d="${polygonPath(482, -67.5)} ${polygonPath(424, -67.5)}"`,
    ` fill="url(#frame-surface)" fill-rule="evenodd"/>`,
    `<polygon points="${polygonPoints(482, -67.5)}" fill="none"`,
    ` stroke="#fff" stroke-opacity=".82" stroke-width="7"/>`,
    `<polygon points="${polygonPoints(424, -67.5)}" fill="none"`,
    ` stroke="#5b52df" stroke-opacity=".32" stroke-width="4"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="466" fill="none"`,
    ` stroke="#fff" stroke-opacity=".52" stroke-width="3"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="416" fill="none"`,
    ` stroke="#6b62da" stroke-opacity=".2" stroke-width="3"/>`,
    "</g>",
    `<g>${frameMounts()}</g>`,
    `<path d="M512 25 L526 39 L512 53 L498 39 Z"`,
    ` fill="#f39047" fill-opacity=".88" stroke="#fff"`,
    ` stroke-width="4"/>`,
    `<path d="M512 971 L526 985 L512 999 L498 985 Z"`,
    ` fill="#5b52df" fill-opacity=".72" stroke="#fff"`,
    ` stroke-width="4"/>`,
  ].join("");

  return svgDocument(content, defs);
}

export function selectorSvg() {
  const defs = [
    selectorGradientDefs(),
    `<radialGradient id="selector-hub" cx="35%" cy="28%">`,
    `<stop offset="0" stop-color="#fff" stop-opacity=".98"/>`,
    `<stop offset=".42" stop-color="#ddd9ff" stop-opacity=".96"/>`,
    `<stop offset="1" stop-color="#8c83e8" stop-opacity=".98"/>`,
    "</radialGradient>",
    `<filter id="selector-shadow" x="-20%" y="-20%" width="140%"`,
    ` height="150%">`,
    `<feDropShadow dx="0" dy="12" stdDeviation="13"`,
    ` flood-color="#5143b3" flood-opacity=".22"/>`,
    "</filter>",
  ].join("");

  const content = [
    `<g filter="url(#selector-shadow)">`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="405"`,
    ` fill="#fff" fill-opacity=".3" stroke="#fff"`,
    ` stroke-opacity=".92" stroke-width="6"/>`,
    selectorSegments(),
    `<circle cx="${CENTER}" cy="${CENTER}" r="397" fill="none"`,
    ` stroke="#3737ad" stroke-opacity=".34" stroke-width="5"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="144"`,
    ` fill="url(#selector-hub)" stroke="#fff"`,
    ` stroke-opacity=".95" stroke-width="6"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="122" fill="none"`,
    ` stroke="#5b52df" stroke-opacity=".24" stroke-width="4"/>`,
    "</g>",
  ].join("");

  return svgDocument(content, defs);
}

export function buttonSvg() {
  const defs = [
    `<linearGradient id="button-fill" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#6a60ed"/>`,
    `<stop offset=".58" stop-color="#5547c9"/>`,
    `<stop offset="1" stop-color="#7d48df"/>`,
    "</linearGradient>",
    `<filter id="button-shadow" x="-30%" y="-30%" width="160%"`,
    ` height="170%">`,
    `<feDropShadow dx="0" dy="16" stdDeviation="15"`,
    ` flood-color="#41329d" flood-opacity=".34"/>`,
    "</filter>",
  ].join("");

  const content = [
    `<g filter="url(#button-shadow)">`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="149" fill="#fff"`,
    ` fill-opacity=".38"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="137"`,
    ` fill="url(#button-fill)" stroke="#fff" stroke-opacity=".95"`,
    ` stroke-width="6"/>`,
    `<circle cx="${CENTER}" cy="${CENTER}" r="115" fill="none"`,
    ` stroke="#ffccd4" stroke-opacity=".78" stroke-width="4"/>`,
    `<path d="M462 489 C476 451 513 429 551 437" fill="none"`,
    ` stroke="#fff" stroke-opacity=".86" stroke-width="10"`,
    ` stroke-linecap="round"/>`,
    `<path d="M548 430 L568 438 L550 452" fill="none"`,
    ` stroke="#fff" stroke-opacity=".86" stroke-width="8"`,
    ` stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${CENTER}" y="548" text-anchor="middle"`,
    ` fill="#fff" font-family="Arial, sans-serif" font-size="42"`,
    ` font-weight="800" letter-spacing="3">PUTAR</text>`,
    "</g>",
  ].join("");

  return svgDocument(content, defs);
}

export function pointerSvg() {
  const defs = [
    `<linearGradient id="pointer-fill" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#ffb35e"/>`,
    `<stop offset="1" stop-color="#e96f8c"/>`,
    "</linearGradient>",
    `<filter id="pointer-shadow" x="-30%" y="-30%" width="160%"`,
    ` height="180%">`,
    `<feDropShadow dx="0" dy="10" stdDeviation="8"`,
    ` flood-color="#4b3aac" flood-opacity=".34"/>`,
    "</filter>",
  ].join("");

  const content = [
    `<g filter="url(#pointer-shadow)">`,
    `<path d="M512 36 L581 99 L549 101 L512 174`,
    ` L475 101 L443 99 Z" fill="url(#pointer-fill)"`,
    ` stroke="#fff" stroke-opacity=".96" stroke-width="7"`,
    ` stroke-linejoin="round"/>`,
    `<path d="M512 52 L548 88" fill="none" stroke="#fff"`,
    ` stroke-opacity=".64" stroke-width="6" stroke-linecap="round"/>`,
    `<circle cx="512" cy="162" r="9" fill="#fff"`,
    ` fill-opacity=".88"/>`,
    "</g>",
  ].join("");

  return svgDocument(content, defs);
}

export const layerSvg = {
  frame: frameSvg,
  selector: selectorSvg,
  button: buttonSvg,
  pointer: pointerSvg,
  glow: glowSvg,
  particles: particlesSvg,
  "win-glow": winGlowSvg,
  shadow: shadowSvg,
};
