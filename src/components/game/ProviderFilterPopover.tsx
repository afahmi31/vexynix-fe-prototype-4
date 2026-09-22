"use client";

import type { Game } from "@/types/api";

export interface ProviderFilterOption {
  id: string;
  name: string;
  count: number;
}

interface ProviderFilterPopoverProps {
  previewGame: Game | null;
  providerOptions: ProviderFilterOption[];
  selectedProviderIds: string[];
  vendorName: (id: string) => string;
  onToggleProvider: (id: string) => void;
  onClearProviders: () => void;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  onInfo: (game: Game) => void;
  launching: string | null;
  disabled: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProviderFilterPopover({
  previewGame,
  providerOptions,
  selectedProviderIds,
  vendorName,
  onToggleProvider,
  onClearProviders,
  onLaunch,
  onLaunchDemo,
  onInfo,
  launching,
  disabled,
}: ProviderFilterPopoverProps) {
  const previewIsLaunching = previewGame ? launching === previewGame.id : false;
  const previewCanDemo = Boolean(previewGame?.demo_supported);
  const selectedCount = selectedProviderIds.length;
  const previewProvider = previewGame ? vendorName(previewGame.vendor_id) : "Semua Provider";

  return (
    <div className="provider-filter-popover" role="dialog" aria-label="Pilih provider game">
      {previewGame ? (
        <div className="provider-filter-preview">
          <div className="provider-filter-preview-media">
            {previewGame.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewGame.image_url} alt="" />
            ) : (
              <span>{previewGame.name.charAt(0).toUpperCase()}</span>
            )}
            <div className="provider-filter-preview-badges">
              <span>{previewGame.category}</span>
              {previewCanDemo && <span>Gratis</span>}
            </div>
          </div>
          <div className="provider-filter-preview-content">
            <div className="provider-filter-preview-actions">
              <button
                className="provider-filter-preview-play"
                type="button"
                disabled={disabled || previewIsLaunching}
                aria-label={`Mainkan ${previewGame.name}`}
                onClick={() => onLaunch(previewGame.id)}
              >
                <i className={previewIsLaunching ? "fa fa-spinner fa-spin" : "fa fa-play"} />
              </button>
              {previewCanDemo && (
                <button
                  className="provider-filter-preview-secondary"
                  type="button"
                  disabled={disabled || previewIsLaunching}
                  onClick={() => onLaunchDemo(previewGame.id)}
                >
                  Coba Gratis
                </button>
              )}
              <button
                className="provider-filter-preview-info"
                type="button"
                disabled={disabled || previewIsLaunching}
                aria-label={`Lihat detail ${previewGame.name}`}
                onClick={() => onInfo(previewGame)}
              >
                <i className="fa fa-circle-info" />
              </button>
            </div>
            <div className="provider-filter-preview-meta">
              {previewGame.rtp ? <span>RTP {(previewGame.rtp * 100).toFixed(1)}%</span> : null}
              {previewGame.min_bet && previewGame.min_bet > 0 ? (
                <span>Mulai {formatCurrency(previewGame.min_bet)}</span>
              ) : null}
            </div>
            <h4>{previewProvider}</h4>
            <p>{previewGame.name}</p>
          </div>
        </div>
      ) : (
        <div className="provider-filter-preview-empty">Tidak ada game pada filter ini.</div>
      )}

      <div className="provider-filter-list" aria-label="Daftar provider">
        <button
          className={`provider-filter-option ${selectedCount === 0 ? "is-selected" : ""}`}
          type="button"
          aria-pressed={selectedCount === 0}
          onClick={onClearProviders}
        >
          <span className="provider-filter-option-name">
            <i className="fa-solid fa-check" />
            Semua Provider
          </span>
          <span className="provider-filter-option-count">
            {providerOptions.reduce((total, provider) => total + provider.count, 0)}
          </span>
        </button>
        {providerOptions.map((provider) => {
          const isSelected = selectedProviderIds.includes(provider.id);

          return (
            <button
              key={provider.id}
              className={`provider-filter-option ${isSelected ? "is-selected" : ""}`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggleProvider(provider.id)}
            >
              <span className="provider-filter-option-name">
                <i className="fa-solid fa-building" />
                {provider.name}
              </span>
              <span className="provider-filter-option-count">{provider.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
