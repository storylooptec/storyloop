"use client";

import { useState, type ComponentPropsWithoutRef } from "react";

import styles from "@/app/brand/brand.module.css";

export function PasswordInput(props: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className={styles.passwordInput}>
      <input {...props} type={visible ? "text" : "password"} />
      <button className={styles.passwordToggle} type="button" aria-label={label} title={label}
        aria-controls={props.id} onClick={() => setVisible(value => !value)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? <path d="m3 3 18 18" /> : null}
        </svg>
      </button>
    </div>
  );
}
