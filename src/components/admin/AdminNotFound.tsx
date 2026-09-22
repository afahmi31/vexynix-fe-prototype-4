"use client";

import Link from "next/link";

/**
 * Plain "not found" for tenant-scoped admin resources (P7 shared pattern):
 * a 404 on a tenant-scoped resource renders this — never "exists but belongs
 * to another merchant" (the backend deliberately leaks nothing, and neither
 * does the UI).
 */
export default function AdminNotFound({
  what = "resource",
}: {
  what?: string;
}) {
  return (
    <div className="text-center py-5">
      <i className="fa fa-magnifying-glass fa-3x mb-3 d-block text-muted" />
      <h4 className="mb-2">Not found</h4>
      <p className="text-muted mb-4">The {what} you requested was not found.</p>
      <Link href="/admin/merchant" className="btn btn-theme">
        Back to Dashboard
      </Link>
    </div>
  );
}
