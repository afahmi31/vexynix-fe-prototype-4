"use client";

/**
 * P7.3 — form-bearing player action dialogs: RG limits, self-exclusion,
 * lifecycle status. (Freeze/unfreeze are plain confirms and live inline in
 * the profile page.) Each dialog validates client-side, maps API errors via
 * mapPlayerActionError, and closes only on success.
 */
import { useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  useSetPlayerLimits,
  useSelfExcludePlayer,
  useSetPlayerStatus,
} from "@/hooks/useAdminPlayers";
import {
  validateLimitsInput,
  validateSelfExcludeDays,
  mapPlayerActionError,
  PLAYER_LIFECYCLE_OPTIONS,
  type PlayerProfileView,
} from "@/lib/admin-players";
import { formatMoney } from "@/lib/admin-dashboard";

export type PlayerDialogKind = "limits" | "self-exclude" | "freeze" | "unfreeze" | "status";

export default function PlayerActionDialogs({
  id,
  dialog,
  onClose,
  profile,
}: {
  id: string;
  dialog: PlayerDialogKind | null;
  onClose: () => void;
  profile: PlayerProfileView;
}) {
  return (
    <>
      <LimitsDialog id={id} open={dialog === "limits"} onClose={onClose} profile={profile} />
      <SelfExcludeDialog id={id} open={dialog === "self-exclude"} onClose={onClose} />
      <StatusDialog id={id} open={dialog === "status"} onClose={onClose} profile={profile} />
    </>
  );
}

// ---------------------------------------------------------------------------

function LimitsDialog({
  id,
  open,
  onClose,
  profile,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  profile: PlayerProfileView;
}) {
  const limits = useSetPlayerLimits(id);
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDaily("");
    setWeekly("");
    setMonthly("");
    setError(null);
    limits.reset();
    onClose();
  };

  const submit = () => {
    const result = validateLimitsInput({ daily, weekly, monthly });
    if (result.error || !result.values) {
      setError(result.error || "Invalid limits.");
      return;
    }
    setError(null);
    limits.mutate(result.values, {
      onSuccess: close,
      onError: (err) => setError(mapPlayerActionError(err) || "Failed to save limits."),
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title={`RG deposit limits — ${profile.username}`}
      confirmLabel="Save limits"
      submitting={limits.isPending}
      error={error}
      onCancel={close}
      onConfirm={submit}
    >
      <p className="text-muted small">
        Integer minor units ({profile.currency}). Leave a field empty for no
        limit. Current: daily{" "}
        {profile.compliance.limits.daily != null
          ? formatMoney(profile.compliance.limits.daily, profile.currency)
          : "—"}
        , weekly{" "}
        {profile.compliance.limits.weekly != null
          ? formatMoney(profile.compliance.limits.weekly, profile.currency)
          : "—"}
        , monthly{" "}
        {profile.compliance.limits.monthly != null
          ? formatMoney(profile.compliance.limits.monthly, profile.currency)
          : "—"}
        .
      </p>
      <div className="mb-2">
        <label htmlFor="limit-daily" className="form-label">
          Daily limit
        </label>
        <input
          id="limit-daily"
          className="form-control"
          inputMode="numeric"
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
          placeholder="e.g. 1000000"
        />
      </div>
      <div className="mb-2">
        <label htmlFor="limit-weekly" className="form-label">
          Weekly limit
        </label>
        <input
          id="limit-weekly"
          className="form-control"
          inputMode="numeric"
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
        />
      </div>
      <div className="mb-1">
        <label htmlFor="limit-monthly" className="form-label">
          Monthly limit
        </label>
        <input
          id="limit-monthly"
          className="form-control"
          inputMode="numeric"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

// ---------------------------------------------------------------------------

function SelfExcludeDialog({
  id,
  open,
  onClose,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
}) {
  const selfExclude = useSelfExcludePlayer(id);
  const [days, setDays] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDays("30");
    setError(null);
    selfExclude.reset();
    onClose();
  };

  const submit = () => {
    const result = validateSelfExcludeDays(days);
    if (result.error || result.days === null) {
      setError(result.error || "Invalid duration.");
      return;
    }
    setError(null);
    selfExclude.mutate(
      { durationDays: result.days },
      {
        onSuccess: close,
        onError: (err) => setError(mapPlayerActionError(err) || "Self-exclusion failed."),
      }
    );
  };

  return (
    <ConfirmDialog
      open={open}
      title="Self-exclude player"
      variant="warning"
      confirmLabel="Self-exclude"
      submitting={selfExclude.isPending}
      error={error}
      onCancel={close}
      onConfirm={submit}
    >
      <p className="text-muted small">
        The player will be blocked from playing and depositing for the
        duration. Withdrawals remain available per policy.
      </p>
      <label htmlFor="self-exclude-days" className="form-label">
        Duration (days)
      </label>
      <input
        id="self-exclude-days"
        className="form-control"
        inputMode="numeric"
        value={days}
        onChange={(e) => setDays(e.target.value)}
      />
    </ConfirmDialog>
  );
}

// ---------------------------------------------------------------------------

function StatusDialog({
  id,
  open,
  onClose,
  profile,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  profile: PlayerProfileView;
}) {
  const setStatus = useSetPlayerStatus(id);
  const [status, setStatusValue] = useState<"active" | "suspended" | "closed">("active");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setStatusValue("active");
    setError(null);
    setStatus.reset();
    onClose();
  };

  const submit = () => {
    setError(null);
    setStatus.mutate(
      { status },
      {
        onSuccess: close,
        onError: (err) => setError(mapPlayerActionError(err) || "Status change failed."),
      }
    );
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Change status — ${profile.username}`}
      confirmLabel="Change status"
      submitting={setStatus.isPending}
      error={error}
      onCancel={close}
      onConfirm={submit}
    >
      <p className="text-muted small">
        Current status: <strong>{profile.status.toUpperCase()}</strong>.
        Suspended/closed players cannot deposit or play; closing is a terminal
        lifecycle state.
      </p>
      <label htmlFor="player-status-select" className="form-label">
        New status
      </label>
      <select
        id="player-status-select"
        className="form-select"
        value={status}
        onChange={(e) => setStatusValue(e.target.value as "active" | "suspended" | "closed")}
      >
        {PLAYER_LIFECYCLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </ConfirmDialog>
  );
}
