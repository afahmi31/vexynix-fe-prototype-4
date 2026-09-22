"use client";

import { useState } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { usePaymentsReport, useAutoWDRules, useAutoWDDecisions, useSwingConfig, useSwingHistory } from "@/hooks/useAdminReports";
import { formatMoney } from "@/lib/admin-reports";
import type { AutoWDRuleView } from "@/lib/admin-recon";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"payments" | "auto-wd" | "swing">("payments");

  return (
    <>
      <h1 className="page-header">Reports & Configuration</h1>

      <div className="mb-3">
        <ul className="nav nav-tabs">
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "payments" ? "active" : ""}`}
              onClick={() => setActiveTab("payments")}
            >
              Payments Report
            </button>
          </li>
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "auto-wd" ? "active" : ""}`}
              onClick={() => setActiveTab("auto-wd")}
            >
              Auto-Withdrawal Rules
            </button>
          </li>
          <li className={`nav-item`}>
            <button
              className={`nav-link ${activeTab === "swing" ? "active" : ""}`}
              onClick={() => setActiveTab("swing")}
            >
              Swing Config
            </button>
          </li>
        </ul>
      </div>

      {activeTab === "payments" && <PaymentsReportSection />}
      {activeTab === "auto-wd" && <AutoWDSection />}
      {activeTab === "swing" && <SwingSection />}
    </>
  );
}

function PaymentsReportSection() {
  const report = usePaymentsReport();

  if (report.isLoading) {
    return (
      <Panel>
        <PanelHeader>Payments Report</PanelHeader>
        <PanelBody>
          <div className="text-center py-4">
            <div className="spinner-border text-theme" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (report.isError || !report.data) {
    return (
      <Panel>
        <PanelHeader>Payments Report</PanelHeader>
        <PanelBody>
          <div className="alert alert-danger">Failed to load payments report.</div>
        </PanelBody>
      </Panel>
    );
  }

  const data = report.data;

  return (
    <Panel>
      <PanelHeader>Payments Report</PanelHeader>
      <PanelBody>
        <h5 className="mb-3">{data.summary.period}</h5>

        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card bg-light h-100">
              <div className="card-body">
                <h6 className="text-muted small">Total Deposits</h6>
                <div className="h4 mb-0">{formatMoney(data.summary.totalDeposits, data.summary.currency)}</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-light h-100">
              <div className="card-body">
                <h6 className="text-muted small">Total Withdrawals</h6>
                <div className="h4 mb-0 text-danger">{formatMoney(data.summary.totalWithdrawals, data.summary.currency)}</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-light h-100">
              <div className="card-body">
                <h6 className="text-muted small">Total Fees</h6>
                <div className="h4 mb-0">{formatMoney(data.summary.totalFees, data.summary.currency)}</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-theme text-white h-100">
              <div className="card-body">
                <h6 className="small opacity-75">Net Revenue</h6>
                <div className="h4 mb-0">{formatMoney(data.summary.netRevenue, data.summary.currency)}</div>
              </div>
            </div>
          </div>
        </div>

        {Array.isArray(data.byMethod) && data.byMethod.length > 0 && (
          <div>
            <h6 className="mb-3">By Payment Method</h6>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Method</th>
                  <th style={{ width: "80px", textAlign: "right" }}>Count</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.byMethod.map((m) => (
                  <tr key={String(m.method)}>
                    <td><strong>{String(m.method)}</strong></td>
                    <td className="text-end">{m.count.toLocaleString()}</td>
                    <td className="text-end">{formatMoney(m.totalAmount, data.summary.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function AutoWDSection() {
  const rulesQuery = useAutoWDRules();
  const decisionsQuery = useAutoWDDecisions();

  if (rulesQuery.isLoading || decisionsQuery.isLoading) {
    return (
      <Panel>
        <PanelHeader>Auto-Withdrawal Rules</PanelHeader>
        <PanelBody>
          <div className="text-center py-4">
            <div className="spinner-border text-theme" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (rulesQuery.isError || decisionsQuery.isError) {
    return (
      <Panel>
        <PanelHeader>Auto-Withdrawal Rules</PanelHeader>
        <PanelBody>
          <div className="alert alert-danger">Failed to load auto-withdrawal data.</div>
        </PanelBody>
      </Panel>
    );
  }

  const rulesData = rulesQuery.data ?? { rules: [], total: 0 };
  const decisionsData = decisionsQuery.data ?? [];

  return (
    <>
      <Panel>
        <PanelHeader>Rules</PanelHeader>
        <PanelBody>
          {rulesData.rules.length === 0 ? (
            <div className="text-muted small">No auto-withdrawal rules configured.</div>
          ) : (
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Min</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Max</th>
                  <th style={{ width: "150px" }}>Segment</th>
                </tr>
              </thead>
              <tbody>
                {rulesData.rules.slice(0, 50).map((rule: AutoWDRuleView) => (
                  <tr key={rule.id}>
                    <td><strong>{rule.name}</strong></td>
                    <td>
                      <span className={`badge ${rule.enabled ? "bg-success" : "bg-secondary"}`}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="text-center">{formatMoney(rule.minAmount, rule.currency)}</td>
                    <td className="text-center">{formatMoney(rule.maxAmount, rule.currency)}</td>
                    <td>{rule.playerSegment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelBody>
      </Panel>

      <Panel className="mt-3">
        <PanelHeader>Decisions Log</PanelHeader>
        <PanelBody>
          {decisionsData.length === 0 ? (
            <div className="text-muted small">No auto-withdrawal decisions recorded yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: "180px" }}>Timestamp</th>
                    <th>Player</th>
                    <th style={{ width: "100px", textAlign: "right" }}>Amount</th>
                    <th style={{ width: "80px" }}>Decision</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionsData.slice(0, 100).map((decision) => (
                    <tr key={decision.id}>
                      <td className="small font-monospace text-muted">
                        {new Date(decision.createdAt).toLocaleString()}
                      </td>
                      <td>{decision.playerUsername}</td>
                      <td className="text-end">{formatMoney(decision.amount)}</td>
                      <td>
                        <code className={`badge ${decision.decision === "approved" ? "bg-success" : "bg-secondary"}`}>
                          {decision.decision}
                        </code>
                      </td>
                      <td>{decision.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}

function SwingSection() {
  const configQuery = useSwingConfig();
  const historyQuery = useSwingHistory();

  if (configQuery.isLoading || historyQuery.isLoading) {
    return (
      <Panel>
        <PanelHeader>Swing (Provider Balancing)</PanelHeader>
        <PanelBody>
          <div className="text-center py-4">
            <div className="spinner-border text-theme" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (configQuery.isError || historyQuery.isError || !configQuery.data || !historyQuery.data) {
    return (
      <Panel>
        <PanelHeader>Swing Config</PanelHeader>
        <PanelBody>
          <div className="alert alert-danger">Failed to load swing configuration.</div>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <PanelHeader>Configuration</PanelHeader>
        <PanelBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <strong>Enabled</strong>
              <span className="ms-2">
                <span className={`badge ${configQuery.data.enabled ? "bg-success" : "bg-secondary"}`}>
                  {configQuery.data.enabled ? "ON" : "OFF"}
                </span>
              </span>
            </div>
            <div>
              <strong>Strategy</strong>
              <code className="ms-2 badge bg-secondary">{configQuery.data.strategy}</code>
            </div>
            <div>
              <strong>Interval</strong>
              <code className="ms-2 badge bg-secondary">{configQuery.data.rebalanceIntervalMinutes} min</code>
            </div>
          </div>

          <div className="alert alert-info">
            <i className="fa fa-info-circle me-2" />
            Swing automatically balances provider balances to optimize game availability across vendors.
          </div>
        </PanelBody>
      </Panel>

      <Panel className="mt-3">
        <PanelHeader>Recent Runs</PanelHeader>
        <PanelBody>
          {historyQuery.data.length === 0 ? (
            <div className="text-muted small">No swing runs recorded yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: "180px" }}>Started At</th>
                    <th style={{ width: "120px" }}>Status</th>
                    <th style={{ width: "150px", textAlign: "right" }}>Rebalanced Providers</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data.slice(0, 50).map((run) => (
                    <tr key={run.id}>
                      <td className="small font-monospace text-muted">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${
                          run.status === "completed" ? "bg-success" :
                          run.status === "running" ? "bg-warning" : "bg-secondary"
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="text-end">{run.rebalancedProviders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
