function starPoints(outerRadius, innerRadius, count = 8) {
  return Array.from({ length: count * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -90 + (index * 180) / count;
    const x = radius * Math.cos((angle * Math.PI) / 180);
    const y = radius * Math.sin((angle * Math.PI) / 180);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export const GAME_SEGMENTS = [
  { id: "neon-racer", name: "Neon Racer", icon: "racer" },
  { id: "solar-riches", name: "Solar Riches", icon: "sun" },
  { id: "velvet-roulette", name: "Velvet Roulette", icon: "roulette" },
  { id: "deep-sea-odyssey", name: "Deep Sea Odyssey", icon: "sea" },
  { id: "sweet-bonanza", name: "Sweet Bonanza", icon: "candy" },
  { id: "gates-of-olympus", name: "Gates of Olympus", icon: "bolt" },
  { id: "mahjong-ways-2", name: "Mahjong Ways 2", icon: "tiles" },
  { id: "lucky-fortune-cat", name: "Lucky Fortune Cat", icon: "cat" },
];

export function iconMarkup(index) {
  const common = 'fill="none" stroke="#23259b" stroke-width="8"';
  const icon = GAME_SEGMENTS[index]?.icon;

  switch (icon) {
    case "racer":
      return `<path d="M-39 13 L-28 -16 H-7 L3 -30 H24 L40 13` +
        ` V27 H-39 Z" fill="#fff" fill-opacity=".94"` +
        ` stroke="#23259b" stroke-width="7"` +
        ` stroke-linejoin="round"/>` +
        `<path d="M-12 -12 H17" ${common}/>` +
        `<circle cx="-23" cy="27" r="10" fill="#f39047"` +
        ` stroke="#23259b" stroke-width="6"/>` +
        `<circle cx="25" cy="27" r="10" fill="#f39047"` +
        ` stroke="#23259b" stroke-width="6"/>`;
    case "sun":
      return `<circle r="25" fill="#f39047" fill-opacity=".94"` +
        ` stroke="#23259b" stroke-width="7"/>` +
        `<circle r="11" fill="#fff"/>` +
        `<g ${common} stroke-linecap="round">` +
        `<path d="M0 -47 V-36 M0 36 V47 M-47 0 H-36 M36 0 H47"/>` +
        `<path d="M-33 -33 L-25 -25 M25 25 L33 33 M33 -33 L25 -25` +
        ` M-25 25 L-33 33"/></g>`;
    case "roulette":
      return `<circle r="34" fill="#fff" fill-opacity=".94"` +
        ` stroke="#23259b" stroke-width="7"/>` +
        `<circle r="24" fill="#f39047" fill-opacity=".92"` +
        ` stroke="#23259b" stroke-width="5"/>` +
        `<path d="M0 -24 V24 M-24 0 H24 M-17 -17 L17 17 M17 -17` +
        ` L-17 17" fill="none" stroke="#23259b" stroke-width="5"/>` +
        `<circle r="8" fill="#fff" stroke="#23259b" stroke-width="4"/>`;
    case "sea":
      return `<path d="M-40 8 C-20 -25 18 -27 33 -3 L48 -16` +
        ` L42 16 L52 29 L29 18 C11 37 -24 32 -40 8 Z"` +
        ` fill="#fff" fill-opacity=".94" stroke="#23259b"` +
        ` stroke-width="7" stroke-linejoin="round"/>` +
        `<circle cx="18" cy="-7" r="4" fill="#f39047"/>` +
        `<path d="M-31 34 C-17 24 -4 24 9 34 C22 44 35 44 47 35"` +
        ` fill="none" stroke="#23259b" stroke-width="6"/>`;
    case "candy":
      return `<path d="M-28 -16 C-16 -32 16 -32 28 -16` +
        ` C39 -3 36 21 18 29 C8 34 -8 34 -18 29` +
        ` C-36 21 -39 -3 -28 -16 Z" fill="#fff"` +
        ` fill-opacity=".94" stroke="#23259b" stroke-width="7"/>` +
        `<path d="M-20 -4 C-9 -16 9 -16 20 -4 C9 8 -9 8 -20 -4 Z"` +
        ` fill="#f39047" stroke="#23259b" stroke-width="5"/>` +
        `<path d="M-12 34 L-26 48 M12 34 L26 48"` +
        ` fill="none" stroke="#23259b" stroke-width="8"` +
        ` stroke-linecap="round"/>`;
    case "bolt":
      return `<path d="M8 -42 L-27 3 H-3 L-13 42 L29 -13 H5 Z"` +
        ` fill="#f39047" stroke="#23259b" stroke-width="7"` +
        ` stroke-linejoin="round"/>` +
        `<path d="${starPoints(46, 37, 4)}" fill="none"` +
        ` stroke="#fff" stroke-opacity=".8" stroke-width="4"/>`;
    case "tiles":
      return `<g fill="#fff" fill-opacity=".94" stroke="#23259b"` +
        ` stroke-width="6">` +
        `<rect x="-39" y="-25" width="28" height="50" rx="5"/>` +
        `<rect x="-14" y="-33" width="28" height="58" rx="5"/>` +
        `<rect x="11" y="-25" width="28" height="50" rx="5"/>` +
        `</g><path d="M-31 -8 H-19 M-31 9 H-19 M-6 -9 H6 M-6` +
        ` 8 H6 M19 -8 H31 M19 9 H31"` +
        ` fill="none" stroke="#23259b" stroke-width="5"/>`;
    case "cat":
      return `<path d="M-35 -8 L-31 -37 L-8 -23 C-2 -25 2 -25 8 -23` +
        ` L31 -37 L35 -8 C36 20 17 36 0 36 C-17 36 -36 20 -35 -8 Z"` +
        ` fill="#fff" fill-opacity=".94" stroke="#23259b"` +
        ` stroke-width="7" stroke-linejoin="round"/>` +
        `<circle cx="-13" cy="-4" r="4" fill="#23259b"/>` +
        `<circle cx="13" cy="-4" r="4" fill="#23259b"/>` +
        `<path d="M-7 9 Q0 16 7 9 M0 4 V11"` +
        ` fill="none" stroke="#23259b" stroke-width="5"` +
        ` stroke-linecap="round"/>` +
        `<circle cx="0" cy="-27" r="10" fill="#f39047"` +
        ` stroke="#23259b" stroke-width="5"/>`;
    default:
      return `<polygon points="${starPoints(31, 13)}" fill="#fff"` +
        ` fill-opacity=".9" stroke="#23259b" stroke-width="7"/>`;
  }
}

