"use client";

import { useState } from "react";
import { Panel, PanelBody } from "@/components/panel/panel";
import BrandProfilePanel from "@/components/admin/brand/BrandProfilePanel";
import DomainsPanel from "@/components/admin/brand/DomainsPanel";
import PasswordChangePanel from "@/components/admin/brand/PasswordChangePanel";
import AuditLogPanel from "@/components/admin/brand/AuditLogPanel";

type Tab = "profile" | "domains" | "password" | "audit";

export default function BrandPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <>
      <h1 className="page-header">Brand & Account</h1>

      <div className="mb-3">
        <ul className="nav nav-tabs">
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              Brand Profile
            </button>
          </li>
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "domains" ? "active" : ""}`}
              onClick={() => setActiveTab("domains")}
            >
              Domains
            </button>
          </li>
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "password" ? "active" : ""}`}
              onClick={() => setActiveTab("password")}
            >
              Change Password
            </button>
          </li>
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              Your Audit Log
            </button>
          </li>
        </ul>
      </div>

      <Panel>
        <PanelBody>
          {activeTab === "profile" && <BrandProfilePanel />}
          {activeTab === "domains" && <DomainsPanel />}
          {activeTab === "password" && <PasswordChangePanel />}
          {activeTab === "audit" && <AuditLogPanel />}
        </PanelBody>
      </Panel>
    </>
  );
}
