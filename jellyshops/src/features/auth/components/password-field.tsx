"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./merchant-auth.module.css";

export function MerchantPasswordField({ id, label, sideAction, ...input }: ComponentProps<"input"> & {
  id: string; label: string; sideAction?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>{label}</label>
        {sideAction}
      </div>
      <div className={styles.password}>
        <input {...input} className={styles.input} id={id} type={visible ? "text" : "password"} />
        <button
          type="button"
          className={styles.visibility}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export const newPasswordMinimum = 6;
