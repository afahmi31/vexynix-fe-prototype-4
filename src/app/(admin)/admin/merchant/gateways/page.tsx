"use client";

/**
 * P7.6 — Payment gateways page (/admin/merchant/gateways).
 *
 * Features:
 * - List: GET /v1/admin/providers
 * - Create/edit: POST, PUT /:id forms with Zod config validation
 * - Credential ref format: ^(env|file|vault|dev): — dev: warned in UI
 * - Status toggle via edit form
 */
import { useState, useCallback } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { useAdminGateways } from "@/hooks/useAdminGateways";
import { isApiError } from "@/lib/api/client";
import GatewayTable from "@/components/admin/gateways/GatewayTable";
import GatewayForm from "@/components/admin/gateways/GatewayForm";
import AdminNotFound from "@/components/admin/AdminNotFound";
import type { GatewayRow } from "@/lib/admin-gateways";

type PageView =
  | { kind: "list" }
  | { kind: "form"; mode: "create" | "edit"; initial: GatewayRow | null };

export default function GatewaysPage() {
  const [view, setView] = useState<PageView>({ kind: "list" });
  const [busyIds] = useState<Set<string>>(new Set());

  const list = useAdminGateways();

  const handleCreateClick = useCallback(() => {
    setView({ kind: "form", mode: "create", initial: null });
  }, []);

  const handleEditClick = useCallback((row: GatewayRow) => {
    setView({ kind: "form", mode: "edit", initial: row });
  }, []);

  const handleBackToList = useCallback(() => {
    setView({ kind: "list" });
  }, []);

  // Tenant-scoped 404 → plain "not found"
  if (isApiError(list.error, 404)) {
    return <AdminNotFound what="payment gateways" />;
  }

  if (view.kind === "form") {
    return (
      <>
        <h1 className="page-header">Payment Gateways</h1>
        <Panel>
          <PanelHeader>
            {view.mode === "create" ? "New Gateway" : "Edit Gateway"}
          </PanelHeader>
          <PanelBody>
            <GatewayForm
              mode={view.mode}
              initial={view.initial}
              onSuccess={handleBackToList}
              onCancel={handleBackToList}
            />
          </PanelBody>
        </Panel>
      </>
    );
  }

  return (
    <>
      <h1 className="page-header">Payment Gateways</h1>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn btn-theme btn-sm" onClick={handleCreateClick}>
          <i className="fa fa-plus me-2" />
          New Gateway
        </button>
      </div>

      <Panel>
        <PanelHeader>Gateway List</PanelHeader>
        <PanelBody>
          {list.isLoading && (
            <GatewayTable rows={[]} total={0} loading={true} onEdit={() => {}} busyIds={busyIds} />
          )}
          {list.isError && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <span>Failed to load gateways.</span>
              <button className="btn btn-sm btn-danger" onClick={() => list.refetch()}>
                Retry
              </button>
            </div>
          )}
          {list.isSuccess && (
            <GatewayTable
              rows={list.data.rows}
              total={list.data.total}
              loading={false}
              onEdit={handleEditClick}
              busyIds={busyIds}
            />
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
