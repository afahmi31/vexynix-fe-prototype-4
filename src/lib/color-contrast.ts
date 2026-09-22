/**
 * Color contrast utilities for brand colors.
 * Ensures text on brand-colored backgrounds meets WCAG contrast standards.
 */

/**
 * Calculate relative luminance of a color (0-1).
 * Formula from WCAG 2.1: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(hex: string): number {
  const rgb = parseInt(hex.replace("#", ""), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Get a contrast-safe text color for a background color.
 * Returns either white or black text depending on the background luminance.
 * Threshold: luminance > 0.5 → black text, otherwise white text.
 */
export function getContrastTextColor(backgroundColor: string): "#000000" | "#FFFFFF" {
  const luminance = getLuminance(backgroundColor);
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

/**
 * Check if a color combination meets WCAG AA contrast standard (4.5:1).
 * Returns true if contrast ratio is sufficient.
 */
export function meetsContrastStandard(
  foregroundColor: string,
  backgroundColor: string
): boolean {
  const fgLuminance = getLuminance(foregroundColor);
  const bgLuminance = getLuminance(backgroundColor);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return ratio >= 4.5;
}

/**
 * Get a contrast-adjusted color that meets WCAG AA standards.
 * If the provided color doesn't meet standards against the background,
 * return a fallback color (either lightened or darkened version).
 */
export function getContrastSafeColor(
  preferredColor: string,
  backgroundColor: string
): string {
  if (meetsContrastStandard(preferredColor, backgroundColor)) {
    return preferredColor;
  }

  // If contrast is poor, return white or black as fallback
  return getContrastTextColor(backgroundColor);
}

/**
 * Parse a CSS color value to hex format.
 * Supports hex (#RRGGBB) and rgb(r, g, b) formats.
 */
export function parseColorToHex(color: string): string {
  // Already hex
  if (color.startsWith("#")) {
    return color.length === 7 ? color : color;
  }

  // rgb(r, g, b) format
  if (color.startsWith("rgb")) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0] ?? "0");
      const g = parseInt(matches[1] ?? "0");
      const b = parseInt(matches[2] ?? "0");
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  }

  // Default to black if parsing fails
  return "#000000";
}
