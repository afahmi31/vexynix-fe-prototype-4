"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody } from "@/components/panel/panel";
import { useSessionStore } from "@/stores/session";
import PasswordChangePanel from "@/components/admin/brand/PasswordChangePanel";

export default function MerchantAccountPage() {
  const router = useRouter();
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const hydrated = useSessionStore((s) => s.hydrated);

  // If must_change_password is true, this page is the forced destination
  // If it's false after hydration, redirect to the main merchant dashboard
  useEffect(() => {
    if (hydrated && !mustChangePassword) {
      router.push("/admin/merchant");
    }
  }, [hydrated, mustChangePassword, router]);

  if (!hydrated) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5 my-5">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!mustChangePassword) {
    // Will redirect in useEffect
    return null;
  }

  return (
    <>
      <h1 className="page-header">Merchant Account Setup</h1>

      <div className="alert alert-warning">
        <i className="fa fa-exclamation-triangle me-2" />
        <strong>Password change required.</strong> You must change your password before accessing the merchant console.
      </div>

      <Panel>
        <PanelBody>
          <PasswordChangePanel />
        </PanelBody>
      </Panel>
    </>
  );
}
