"use client";

import { useEffect, useId, useState, type ComponentProps } from "react";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  passwordLabel?: string;
};

export default function PasswordInput({
  id,
  style,
  disabled,
  passwordLabel = "password",
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById(inputId)?.closest("form");
    const hide = () => setVisible(false);
    form?.addEventListener("submit", hide);
    form?.addEventListener("reset", hide);
    return () => {
      form?.removeEventListener("submit", hide);
      form?.removeEventListener("reset", hide);
    };
  }, [inputId]);

  return (
    <span className="relative block">
      <input
        spellCheck={false}
        autoCapitalize="none"
        {...props}
        id={inputId}
        disabled={disabled}
        type={visible ? "text" : "password"}
        style={{ ...style, paddingRight: "5.5rem" }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`${visible ? "Hide" : "Show"} ${passwordLabel}`}
        aria-controls={inputId}
        onClick={() => setVisible(current => !current)}
        className="absolute right-1 top-1/2 flex min-h-11 min-w-18 gap-1.5 px-2 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!visible && <path d="m3 3 18 18" />}
        </svg>
        <span className="text-xs font-semibold">{visible ? "Hide" : "Show"}</span>
      </button>
    </span>
  );
}
