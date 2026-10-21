import type { SVGProps } from "react";

export default function LaundryIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 240 160" fill="none" aria-hidden="true" focusable="false" {...props}>
      <ellipse cx="124" cy="145" rx="82" ry="9" fill="#bfdbfe" />
      <g stroke="#60a5fa" strokeWidth="2.5">
        <circle cx="33" cy="56" r="20" fill="#eff6ff" /><circle cx="201" cy="35" r="16" fill="#dbeafe" />
        <circle cx="211" cy="91" r="26" fill="#eff6ff" /><circle cx="52" cy="111" r="11" fill="#dbeafe" />
        <circle cx="62" cy="24" r="8" fill="white" /><circle cx="183" cy="124" r="9" fill="white" />
      </g>
      <g stroke="white" strokeWidth="3" strokeLinecap="round"><path d="m23 48 5-4M193 29l4-3M200 78l6-4" /></g>
      <rect x="72" y="23" width="99" height="119" rx="15" fill="white" stroke="#2563eb" strokeWidth="3" />
      <path d="M74 52h95" stroke="#bfdbfe" strokeWidth="3" />
      <rect x="84" y="34" width="31" height="8" rx="3" fill="#dbeafe" />
      <circle cx="153" cy="38" r="5" fill="#2563eb" /><circle cx="136" cy="38" r="3" fill="#38bdf8" />
      <circle cx="122" cy="96" r="32" fill="#dbeafe" stroke="#2563eb" strokeWidth="5" />
      <circle cx="122" cy="96" r="24" fill="#7dd3fc" />
      <path d="M100 97q11-12 22 0t22 0v5a23 23 0 0 1-44 0Z" fill="#2563eb" />
      <path d="M107 82q7-8 16-7" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 83v10m-5-5h10m141-71v10m-5-5h10" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
