export function resolveBffAssetUrl(path: string | undefined): string | undefined {
  if (!path || !path.startsWith("/")) return path;
  if (process.env.NEXT_PUBLIC_PROTOTYPE_MODE !== "external") return path;

  const origin = process.env.NEXT_PUBLIC_BFF_ORIGIN?.trim().replace(/\/+$/, "");
  return origin ? `${origin}${path}` : path;
}
