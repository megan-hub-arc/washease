import type { SVGProps } from "react";

const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  orders: "M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4",
  deliveries: "M3 6h11v12H3ZM14 10h4l3 4v4h-7M6 18a2 2 0 1 0 4 0M16 18a2 2 0 1 0 4 0",
  people: "M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  payments: "M3 5h18v14H3ZM3 9h18M7 14h4",
  reports: "M4 20V12h4v8M10 20V7h4v13M16 20V3h4v17",
  zones: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  plus: "M12 5v14M5 12h14",
  return: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14",
  menu: "M4 6h16M4 12h16M4 18h16",
  check: "m5 12 4 4L19 6",
} as const;

export type IconName = keyof typeof paths;
export default function WorkspaceIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><path d={paths[name]} /></svg>;
}
