/**
 * Skeleton loading placeholders (P5.5) — Bootstrap 5 placeholder utilities
 * styled to match the real components they stand in for.
 */

export function LobbyGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="game-grid-skeleton placeholder-glow" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="game-card-skeleton placeholder bg-secondary rounded"
        />
      ))}
      <span className="visually-hidden">Memuat game...</span>
    </div>
  );
}

/** Netflix-style lobby placeholder — billboard block + row shimmer strips. */
export function LobbyNetflixSkeleton() {
  return (
    <div className="placeholder-glow" aria-hidden="true">
      <div
        className="placeholder w-100"
        style={{ height: "clamp(440px, 78vh, 900px)", borderRadius: 0, opacity: 0.12 }}
      />
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1.5rem 2rem", overflow: "hidden" }}>
        {[0, 1].map((row) => (
          <div key={row} style={{ marginBottom: "1.75rem" }}>
            <span className="placeholder col-2 d-block mb-2" />
            <div className="d-flex gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="placeholder"
                  style={{
                    width: 148,
                    aspectRatio: "3 / 4",
                    borderRadius: ".5rem",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="visually-hidden">Memuat game...</span>
    </div>
  );
}

export function BalancePillSkeleton() {
  return (
    <div className="navbar-item d-none d-md-flex placeholder-glow" aria-hidden="true">
      <span className="badge bg-secondary fs-6 px-3 py-2">
        <span className="placeholder" style={{ width: "4rem" }} />
      </span>
      <span className="visually-hidden">Memuat saldo...</span>
    </div>
  );
}

export function StatusTimelineSkeleton() {
  return (
    <div className="card placeholder-glow" aria-hidden="true">
      <div className="card-body">
        <span className="placeholder col-4 d-block mb-3" />
        <span className="placeholder col-8 d-block mb-2" />
        <span className="placeholder col-7 d-block mb-2" />
        <span className="placeholder col-6 d-block mb-2" />
        <span className="placeholder col-5 d-block mb-0" />
        <span className="visually-hidden">Memuat status...</span>
      </div>
    </div>
  );
}

/** P7.2 — placeholder for the six KPI stat widgets. */
export function DashboardKpiSkeleton() {
  return (
    <div className="row g-3 mb-3 placeholder-glow" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="col-xl-2 col-lg-4 col-md-4 col-sm-6" key={i}>
          <div className="widget widget-stats bg-secondary">
            <div className="stats-info">
              <h4>
                <span className="placeholder col-8" />
              </h4>
              <p>
                <span className="placeholder col-6" />
              </p>
            </div>
          </div>
        </div>
      ))}
      <span className="visually-hidden">Loading dashboard...</span>
    </div>
  );
}

/** P7.2 — placeholder for the dashboard time-series chart. */
export function DashboardChartSkeleton() {
  return (
    <div className="placeholder-glow" aria-hidden="true">
      <div
        className="placeholder w-100 bg-secondary rounded"
        style={{ height: "300px", opacity: 0.25 }}
      />
      <span className="visually-hidden">Loading chart...</span>
    </div>
  );
}

/** P7.3/P7.4 — placeholder for admin tables (directory, audit, approvals). */
export function AdminTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="placeholder-glow" aria-hidden="true">
      <div className="d-flex flex-column gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <span
            key={i}
            className="placeholder col-12 rounded"
            style={{ height: "2.25rem", opacity: 0.2 }}
          />
        ))}
      </div>
      <span className="visually-hidden">Loading table...</span>
    </div>
  );
}
