"use client";

/**
 * P7.3 — Players directory (interactive part of /admin/merchant/players).
 *
 * Server-paginated table (handle, status, lifetime totals) with a search box
 * and a status filter. Filters are mirrored in the URL query params
 * (?q=&status=&page=) so every view is a shareable link; the URL drives the
 * query key, so back/forward navigation restores the exact list state.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import RegisterPlayerDialog from "@/components/admin/players/RegisterPlayerDialog";
import { useAdminPlayers } from "@/hooks/useAdminPlayers";
import {
  parseDirectoryQuery,
  statusBadgeClass,
  PLAYER_STATUS_OPTIONS,
} from "@/lib/admin-players";
import { formatMoney } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";
import AdminNotFound from "@/components/admin/AdminNotFound";

export default function PlayersDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseDirectoryQuery(searchParams);

  // Search box is controlled locally; it commits to the URL on Enter/Search.
  const [searchInput, setSearchInput] = useState(query.search);
  const [showRegister, setShowRegister] = useState(false);

  const data = useAdminPlayers(query);

  const pushQuery = (next: { q?: string; status?: string; page?: number }) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) sp.set("q", next.q);
      else sp.delete("q");
    }
    if (next.status !== undefined) {
      if (next.status) sp.set("status", next.status);
      else sp.delete("status");
    }
    if (next.page !== undefined) {
      if (next.page > 1) sp.set("page", String(next.page));
      else sp.delete("page");
    }
    const qs = sp.toString();
    router.push(`/admin/merchant/players${qs ? `?${qs}` : ""}`);
  };

  const submitSearch = () => {
    pushQuery({ q: searchInput.trim(), page: 1 });
  };

  const totalPages = data.data
    ? Math.max(1, Math.ceil(data.data.total / data.data.limit))
    : 1;

  if (isApiError(data.error, 404)) {
    return <AdminNotFound what="players" />;
  }

  return (
    <Panel>
      <PanelHeader>Directory</PanelHeader>
      <PanelBody>
        {/* Search + status filter + register */}
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <input
            id="player-search"
            className="form-control w-auto"
            placeholder="Search username or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            aria-label="Search players"
          />
          <button className="btn btn-theme btn-sm" onClick={submitSearch}>
            <i className="fa fa-search me-1" />
            Search
          </button>
          <select
            id="player-status-filter"
            className="form-select w-auto"
            value={query.status}
            onChange={(e) => pushQuery({ status: e.target.value, page: 1 })}
            aria-label="Filter by status"
          >
            {PLAYER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-success btn-sm ms-auto"
            onClick={() => setShowRegister(true)}
          >
            <i className="fa fa-user-plus me-1" />
            Register Player
          </button>
        </div>

        {/* Skeleton | Error | Empty | Table */}
        {data.isLoading && <AdminTableSkeleton rows={8} />}
        {data.isError && !isApiError(data.error, 404) && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between">
            <span>
              <i className="fa fa-triangle-exclamation me-2" />
              Failed to load players.
            </span>
            <button className="btn btn-sm btn-danger" onClick={() => data.refetch()}>
              Retry
            </button>
          </div>
        )}
        {data.isSuccess && data.data.rows.length === 0 && (
          <div className="text-center py-4 text-muted">
            <i className="fa fa-users fa-2x mb-2 d-block" />
            No players found
            {query.search || query.status ? " for these filters." : " yet."}
          </div>
        )}
        {data.isSuccess && data.data.rows.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Handle</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th className="text-end">Lifetime Deposits</th>
                    <th className="text-end">Lifetime Withdrawals</th>
                    <th>Last Login</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.rows.map((r) => (
                    <tr key={r.userId}>
                      <td>
                        <Link
                          href={`/admin/merchant/players/${r.userId}`}
                          className="fw-semibold text-decoration-none"
                        >
                          {r.username}
                        </Link>
                        <div className="text-muted small">ID {r.userId}</div>
                      </td>
                      <td>{r.phone || "—"}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(r.status)}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-end">
                        {formatMoney(r.totalDeposits, r.currency)}
                      </td>
                      <td className="text-end">
                        {formatMoney(r.totalWithdrawals, r.currency)}
                      </td>
                      <td className="text-muted small">
                        {r.lastLoginAt ? r.lastLoginAt : "—"}
                      </td>
                      <td className="text-end">
                        <Link
                          className="btn btn-sm btn-outline-theme"
                          href={`/admin/merchant/players/${r.userId}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="mt-3" aria-label="Players pagination">
              <ul className="pagination pagination-sm m-0">
                <li className={`page-item ${query.page <= 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => pushQuery({ page: query.page - 1 })}
                    disabled={query.page <= 1}
                  >
                    Prev
                  </button>
                </li>
                <li className="page-item disabled">
                  <span className="page-link">
                    {query.page} / {totalPages}
                  </span>
                </li>
                <li
                  className={`page-item ${query.page >= totalPages ? "disabled" : ""}`}
                >
                  <button
                    className="page-link"
                    onClick={() => pushQuery({ page: query.page + 1 })}
                    disabled={query.page >= totalPages}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </>
        )}
      </PanelBody>

      <RegisterPlayerDialog
        open={showRegister}
        onClose={() => setShowRegister(false)}
      />
    </Panel>
  );
}
