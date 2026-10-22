import type { ReactNode } from "react";

/** Ícones do visual novo: traço de 2 px, pontas redondas, 24x24. Sem biblioteca. */
export type NvIconName =
  | "menu"
  | "search"
  | "mic"
  | "pin"
  | "clock"
  | "bike"
  | "plus"
  | "close"
  | "briefcase"
  | "bag"
  | "table"
  | "pix"
  | "receipt"
  | "link"
  | "bell"
  | "check"
  | "book"
  | "doc"
  | "user"
  | "fork"
  | "back"
  | "card"
  | "cash"
  | "edit"
  | "store"
  | "home"
  | "trash";

const PATHS: Record<NvIconName, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16 9.5 8H13l2 4.5h3M9.5 8H7M12 12.5 14 16" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8.5h13l-1 11h-11l-1-11Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  table: (
    <>
      <path d="M4 9h16M6 9v9M18 9v9M9 9V6h6v3" />
    </>
  ),
  pix: <path d="m12 2.5 3.2 3.2L12 8.9 8.8 5.7 12 2.5Zm0 12.6 3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2ZM2.5 12l3.2-3.2L8.9 12l-3.2 3.2L2.5 12Zm12.6 0 3.2-3.2 3.2 3.2-3.2 3.2-3.2-3.2Z" />,
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
      <path d="M10 20.5h4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  book: <path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12Zm0 12a3 3 0 0 1 3-3h10M9 8h5" />,
  doc: <path d="M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M10 12h5M10 16h5" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  fork: <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6M7 7h4M17 3c-2.2 2-2.2 6 0 9v9" />,
  back: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4" />,
  store: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5c0 1.7 1.3 3 2.7 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.6 3s2.6-1.3 2.6-3c0 1.7 1.3 3 2.7 3S20 11.2 20 9.5M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />,
  home: <path d="m4 11 8-6.5 8 6.5M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  trash: <path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13M10.5 11v6M13.5 11v6" />,
};

export default function NvIcon({ name }: { name: NvIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
