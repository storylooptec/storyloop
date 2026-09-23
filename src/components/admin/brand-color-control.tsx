"use client";

import { useState } from "react";

export function BrandColorControl({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="brand-color-field">
      <span>{label}</span>
      <span className="brand-color-inputs">
        <input
          type="color"
          value={value}
          disabled={disabled}
          aria-label={`${label} color picker`}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
        />
        <input
          name={name}
          value={value}
          disabled={disabled}
          pattern="#[0-9A-Fa-f]{6}"
          aria-label={`${label} hex value`}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
        />
      </span>
    </label>
  );
}
