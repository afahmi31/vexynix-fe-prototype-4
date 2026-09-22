"use client";

import { useState } from "react";
import { useAdminMerchantProfile, useUpdateMerchantProfile } from "@/hooks/useAdminMerchant";
import { getContrastTextColor } from "@/lib/color-contrast";
import type { MerchantProfileView } from "@/lib/admin-merchant";
import type { MerchantProfileReq } from "@/types/api";

export default function BrandProfilePanel() {
  const profile = useAdminMerchantProfile();
  const updateProfile = useUpdateMerchantProfile();

  const [form, setForm] = useState<MerchantProfileReq>({
    name: "",
    logo_url: "",
    theme: {
      primary_color: "",
      secondary_color: "",
    },
  });

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    if (profile.data) {
      setForm({
        name: profile.data.name,
        logo_url: profile.data.logoUrl,
        theme: {
          primary_color: profile.data.theme.primaryColor ?? "",
          secondary_color: profile.data.theme.secondaryColor ?? "",
        },
      });
      setEditing(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateProfile.mutateAsync(form);
      setEditing(false);
    } catch {
      setError("Failed to update profile. Check the form values.");
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({
      name: "",
      logo_url: "",
      theme: {
        primary_color: "",
        secondary_color: "",
      },
    });
    setError(null);
  };

  if (profile.isLoading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return <div className="alert alert-danger">Failed to load brand profile.</div>;
  }

  const profileData = profile.data as MerchantProfileView;

  const primaryColor = profileData.theme.primaryColor ?? "#000000";
  const secondaryColor = profileData.theme.secondaryColor ?? "#FFFFFF";

  const primaryTextColor = getContrastTextColor(primaryColor);
  const secondaryTextColor = getContrastTextColor(secondaryColor);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Brand Profile</h4>
        <button className="btn btn-theme btn-sm" onClick={handleEdit}>
          Edit
        </button>
      </div>

      {!editing ? (
        <div className="row g-3">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Merchant Name</label>
              <div className="font-monospace">{profileData.name || "—"}</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Logo URL</label>
              <div className="font-monospace">{profileData.logoUrl || "—"}</div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Primary Color</label>
              <div
                className="d-inline-block px-3 py-2 rounded"
                style={{
                  backgroundColor: primaryColor,
                  color: primaryTextColor,
                }}
              >
                {profileData.theme.primaryColor ?? "—"}
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Secondary Color</label>
              <div
                className="d-inline-block px-3 py-2 rounded"
                style={{
                  backgroundColor: secondaryColor,
                  color: secondaryTextColor,
                }}
              >
                {profileData.theme.secondaryColor ?? "—"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="row g-3">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label" htmlFor="merchant-name">
                  Merchant Name
                </label>
                <input
                  id="merchant-name"
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="logo-url">
                  Logo URL
                </label>
                <input
                  id="logo-url"
                  type="url"
                  className="form-control"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label" htmlFor="primary-color">
                  Primary Color
                </label>
                <input
                  id="primary-color"
                  type="color"
                  className="form-control form-control-color"
                  value={form.theme.primary_color || "#000000"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      theme: { ...form.theme, primary_color: e.target.value },
                    })
                  }
                  title="Choose primary color"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="secondary-color">
                  Secondary Color
                </label>
                <input
                  id="secondary-color"
                  type="color"
                  className="form-control form-control-color"
                  value={form.theme.secondary_color || "#FFFFFF"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      theme: { ...form.theme, secondary_color: e.target.value },
                    })
                  }
                  title="Choose secondary color"
                />
              </div>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
