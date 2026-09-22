"use client";

/**
 * Floating preview dock for the portal's visual templates.
 *
 * Lets a template and accent preset be tried on live, without editing tenant
 * branding — the choice is a sessionStorage override read by ThemeApplier.
 *
 * Visible in `next dev`, and on a deployed host only once the tab has asked for
 * a preview (?template= / ?preset=). Deliberately NOT behind a server env var:
 * the container receives runtime env only (deploy/client.env -> __ENV.js), and
 * a NEXT_PUBLIC_* value would have to be baked in at image build time, which
 * this project's server-side `docker compose build` never passes. The URL is
 * the switch instead — nothing to configure, nothing to redeploy.
 */
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LOBBY_TEMPLATES, resolveTemplateKey } from "@/lib/lobby-templates";
import { THEME_PRESETS } from "@/lib/theme-presets";
import { usePortalTemplateStore } from "@/stores/portal-template";
import { useBrandStore } from "@/stores/brand";

const IS_DEV = process.env.NODE_ENV !== "production";

/** Swatch gradient for a template — its own default accent, not the tenant's. */
const TEMPLATE_SWATCH: Record<string, string> = {
  classic: "linear-gradient(135deg, #ffd700, #ff9500)",
  neon: "linear-gradient(135deg, #ff2ea6, #00e5ff)",
  luxe: "linear-gradient(135deg, #f0d08a, #b8860b)",
  aurora: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
};

export default function TemplateSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const templateOverride = usePortalTemplateStore((s) => s.templateOverride);
  const presetOverride = usePortalTemplateStore((s) => s.presetOverride);
  const setTemplateOverride = usePortalTemplateStore((s) => s.setTemplateOverride);
  const setPresetOverride = usePortalTemplateStore((s) => s.setPresetOverride);
  const brandTemplate = useBrandStore((s) => s.brand.theme?.template);
  const previewEnabled = usePortalTemplateStore((s) => s.previewEnabled);

  if (pathname === "/lobby" || (!IS_DEV && !previewEnabled)) return null;

  // Same resolution ThemeApplier uses, so the dock always names what is on screen.
  const activeTemplate = resolveTemplateKey(templateOverride ?? brandTemplate);

  return (
    <div className="tpl-dock">
      {open && (
        <div className="tpl-dock-panel">
          <div className="tpl-dock-title">Template</div>
          {Object.entries(LOBBY_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              className={`tpl-dock-option ${activeTemplate === key ? "active" : ""}`}
              onClick={() => setTemplateOverride(key)}
            >
              <span
                className="tpl-dock-swatch"
                style={{ background: TEMPLATE_SWATCH[key] }}
              />
              <span>
                <span className="tpl-dock-label">{tpl.label}</span>
                <span className="tpl-dock-tagline d-block">{tpl.tagline}</span>
              </span>
            </button>
          ))}

          <div className="tpl-dock-title">Accent preset</div>
          <button
            type="button"
            className={`tpl-dock-option ${presetOverride === null ? "active" : ""}`}
            onClick={() => setPresetOverride(null)}
          >
            <span
              className="tpl-dock-swatch"
              style={{ background: TEMPLATE_SWATCH[activeTemplate] }}
            />
            <span className="tpl-dock-label">Template default</span>
          </button>
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`tpl-dock-option ${presetOverride === key ? "active" : ""}`}
              onClick={() => setPresetOverride(key)}
            >
              <span
                className="tpl-dock-swatch"
                style={{
                  background: `linear-gradient(135deg, ${preset.accentStart}, ${preset.accentEnd})`,
                }}
              />
              <span className="tpl-dock-label">{preset.label}</span>
            </button>
          ))}

          <div className="tpl-dock-foot">
            <span>Preview only — tenant branding is untouched.</span>
            <button
              type="button"
              onClick={() => {
                setTemplateOverride(null);
                setPresetOverride(null);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="tpl-dock-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <i className="fa-solid fa-palette" />
        <span>{LOBBY_TEMPLATES[activeTemplate]?.label ?? "Template"}</span>
        <i className={`fa fa-angle-${open ? "down" : "up"}`} />
      </button>
    </div>
  );
}
