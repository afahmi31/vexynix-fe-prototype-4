"use client";

import { useCallback, useState } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { useAdminVendors } from "@/hooks/useAdminVendors";
import { useToggleVendor } from "@/hooks/useAdminVendors";
import { isApiError } from "@/lib/api/client";
import VendorTable from "@/components/admin/vendors/VendorTable";
import AdminNotFound from "@/components/admin/AdminNotFound";

export default function VendorsPage() {
  const [busyIds] = useState<Set<string>>(new Set());

  const vendors = useAdminVendors();
  const toggleVendor = useToggleVendor();

  const handleToggle = useCallback(
    async (vendorId: string, enabled: boolean) => {
      busyIds.add(vendorId);
      try {
        await toggleVendor.mutateAsync({
          vendor_id: vendorId,
          enabled,
        });
      } catch {
        // Rollback on error via optimistic UI — nothing extra to do here
      } finally {
        busyIds.delete(vendorId);
      }
    },
    [busyIds, toggleVendor]
  );

  // Tenant-scoped 404 → plain "not found"
  if (isApiError(vendors.error, 404)) {
    return <AdminNotFound what="vendors list" />;
  }

  return (
    <>
      <h1 className="page-header">Vendors</h1>

      <Panel>
        <PanelHeader>Vendors</PanelHeader>
        <PanelBody>
          <VendorTable
            rows={vendors.data?.rows ?? []}
            total={vendors.data?.total ?? 0}
            loading={vendors.isLoading}
            onToggle={handleToggle}
            busyIds={busyIds}
          />
          {vendors.isError && !vendors.isLoading && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between mt-3">
              <span>Failed to load vendors.</span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => vendors.refetch()}
              >
                Retry
              </button>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
