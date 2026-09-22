"use client";

/**
 * P7.3 — player notes thread (GET/POST /api/spg/v1/admin/players/:id/notes).
 */
import { useState } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import { usePlayerNotes, useAddPlayerNote } from "@/hooks/useAdminPlayers";
import { formatDateTime } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";

export default function PlayerNotes({ id }: { id: string }) {
  const notes = usePlayerNotes(id);
  const addNote = useAddPlayerNote(id);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isApiError(notes.error, 404)) return null; // never shown on tenant-scoped paths

  const submit = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("A note is required.");
      return;
    }
    addNote.mutate(
      { note: trimmed },
      {
        onSuccess: () => {
          setText("");
          setError(null);
        },
        onError: (err: unknown) =>
          setError(err instanceof Error ? err.message : String(err)),
      }
    );
  };

  return (
    <Panel>
      <PanelHeader>Notes</PanelHeader>
      <PanelBody>
        {notes.isLoading ? (
          <AdminTableSkeleton rows={2} />
        ) : (
          <>
            <div className="mb-3">
              {(notes.data?.length ?? 0) === 0 ? (
                <p className="text-muted mb-0">No notes yet.</p>
              ) : (
                <ul className="list-unstyled m-0">
                  {notes.data?.map((n) => (
                    <li key={String(n.id)} className="border-bottom py-2">
                      <div className="d-flex justify-content-between small text-muted mb-1">
                        <span>{n.author ?? "Operator"}</span>
                        <span>{formatDateTime(n.created_at)}</span>
                      </div>
                      <div>{n.note}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label htmlFor={`note-text-${id}`} className="form-label">
                Add a note
              </label>
              <textarea
                id={`note-text-${id}`}
                className="form-control"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="d-flex gap-2 mt-2">
                <button type="submit" className="btn btn-theme btn-sm">
                  {addNote.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Posting...
                    </>
                  ) : (
                    "Post note"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => setText("")}
                >
                  Clear
                </button>
              </div>
              {error && <div className="small text-danger mt-1">{error}</div>}
            </form>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
