/**
 * Players hooks (P7.3) — server-paginated directory + 360° profile + actions.
 *
 * Directory filters live in the URL (shareable links) and are part of the
 * query key, so each filter/page combination caches independently. Profile
 * mutations invalidate the profile query; register invalidates the directory.
 * Step-up: apiFetch handles 401 STEP_UP_REQUIRED globally (P4.1).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type ListPlayersParams } from "@/lib/api/admin";
import {
  toPlayerList,
  toPlayerProfile,
  type PlayerListView,
  type PlayerProfileView,
} from "@/lib/admin-players";
import { useSessionStore } from "@/stores/session";
import type {
  AddPlayerNoteReq,
  AdminPlayerAuditEntry,
  AdminPlayerNote,
  AdminRegisterPlayerReq,
  RegisterRes,
  SetPlayerLimitsReq,
  SetPlayerStatusReq,
} from "@/types/api";

const PLAYERS_KEY = ["admin", "players"] as const;
const profileKey = (id: number | string) => ["admin", "player-profile", id] as const;
const notesKey = (id: number | string) => ["admin", "player-notes", id] as const;
const auditKey = (id: number | string) => ["admin", "player-audit", id] as const;

// ---------------------------------------------------------------------------
// Directory list
// ---------------------------------------------------------------------------

export function useAdminPlayers(params: ListPlayersParams) {
  const token = useSessionStore((s) => s.token);

  return useQuery<PlayerListView>({
    queryKey: [...PLAYERS_KEY, params],
    queryFn: async () => {
      const res = await adminApi.listPlayers(params);
      return toPlayerList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/** Register a player manually (dialog on the directory page). */
export function useRegisterPlayer() {
  const qc = useQueryClient();
  return useMutation<RegisterRes, unknown, AdminRegisterPlayerReq>({
    mutationFn: (req) => adminApi.registerPlayer(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAYERS_KEY }),
  });
}

// ---------------------------------------------------------------------------
// 360° profile
// ---------------------------------------------------------------------------

export function useAdminPlayerProfile(id: number | string) {
  const token = useSessionStore((s) => s.token);

  return useQuery<PlayerProfileView | null>({
    queryKey: profileKey(id),
    queryFn: async () => {
      const res = await adminApi.getPlayerProfile(id);
      return toPlayerProfile(res);
    },
    enabled: !!token && !!id,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/** Shared invalidation for every profile mutation. */
function useInvalidateProfile(id: number | string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: profileKey(id) });
    qc.invalidateQueries({ queryKey: auditKey(id) });
    qc.invalidateQueries({ queryKey: PLAYERS_KEY });
  };
}

export function useSetPlayerLimits(id: number | string) {
  const invalidate = useInvalidateProfile(id);
  return useMutation<void, unknown, SetPlayerLimitsReq>({
    mutationFn: (body) => adminApi.setPlayerLimits(id, body),
    onSuccess: invalidate,
  });
}

export function useSelfExcludePlayer(id: number | string) {
  const invalidate = useInvalidateProfile(id);
  return useMutation<void, unknown, { durationDays: number }>({
    mutationFn: ({ durationDays }) =>
      adminApi.selfExcludePlayer(id, { duration_days: durationDays }),
    onSuccess: invalidate,
  });
}

export function useFreezePlayer(id: number | string) {
  const invalidate = useInvalidateProfile(id);
  return useMutation<void, unknown, void>({
    mutationFn: () => adminApi.freezePlayer(id),
    onSuccess: invalidate,
  });
}

export function useUnfreezePlayer(id: number | string) {
  const invalidate = useInvalidateProfile(id);
  return useMutation<void, unknown, void>({
    mutationFn: () => adminApi.unfreezePlayer(id),
    onSuccess: invalidate,
  });
}

export function useSetPlayerStatus(id: number | string) {
  const invalidate = useInvalidateProfile(id);
  return useMutation<void, unknown, SetPlayerStatusReq>({
    mutationFn: (body) => adminApi.setPlayerStatus(id, body),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Notes thread
// ---------------------------------------------------------------------------

export function usePlayerNotes(id: number | string) {
  const token = useSessionStore((s) => s.token);

  return useQuery<AdminPlayerNote[]>({
    queryKey: notesKey(id),
    queryFn: async () => {
      const res = await adminApi.listPlayerNotes(id);
      return Array.isArray(res?.notes) ? res.notes : [];
    },
    enabled: !!token && !!id,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useAddPlayerNote(id: number | string) {
  const qc = useQueryClient();
  return useMutation<void, unknown, AddPlayerNoteReq>({
    mutationFn: (body) => adminApi.addPlayerNote(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(id) }),
  });
}

// ---------------------------------------------------------------------------
// Audit trail (read-only)
// ---------------------------------------------------------------------------

export function usePlayerAudit(id: number | string) {
  const token = useSessionStore((s) => s.token);

  return useQuery<AdminPlayerAuditEntry[]>({
    queryKey: auditKey(id),
    queryFn: async () => {
      const res = await adminApi.listPlayerAudit(id);
      return Array.isArray(res?.entries) ? res.entries : [];
    },
    enabled: !!token && !!id,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
