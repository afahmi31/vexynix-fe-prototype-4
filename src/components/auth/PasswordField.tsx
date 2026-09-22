"use client";

/**
 * Password input with a show/hide toggle, shared by the login and register
 * modals. Players type long passwords on phone keyboards; letting them read
 * back what they typed cuts down on typos (and on failed logins).
 *
 * Spreads the rest of its props onto the <input>, so a react-hook-form
 * `register("password")` result can be passed straight through (React 19
 * forwards `ref` as a plain prop).
 */
import { useState } from "react";

type PasswordFieldProps = React.ComponentPropsWithRef<"input"> & {
  id: string;
  label: string;
  error?: string;
};

export default function PasswordField({
  id,
  label,
  error,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="form-control"
          {...inputProps}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          title={visible ? "Sembunyikan password" : "Tampilkan password"}
        >
          <i
            className={visible ? "fa fa-eye-slash" : "fa fa-eye"}
            aria-hidden="true"
          />
        </button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}
