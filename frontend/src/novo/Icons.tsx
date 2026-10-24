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
  | "trash"
  | "drop"
  | "sparkle"
  | "orders"
  | "assistant"
  | "products"
  | "costs"
  | "categories"
  | "tables"
  | "zones"
  | "hours"
  | "deliveries"
  | "settle"
  | "business"
  | "payment"
  | "brand"
  | "team"
  | "plan"
  | "subscriptions"
  | "help"
  | "kitchen"
  | "waiter"
  | "cashier"
  | "courier"
  | "approvals"
  | "sales"
  | "customer"
  | "owner"
  | "chevron"
  | "logout"
  | "guide"
  | "qr"
  | "phone"
  | "camera"
  | "image"
  | "copy"
  | "share"
  | "download"
  | "chat";

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
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  orders: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3" />,
  assistant: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21 M9 21h6" />,
  products: <path d="M7 3v7 M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3 M7 10.5V21 M17 3c-2.2 1.2-3 3.4-3 6 0 2.2 1.2 3.6 3 3.6V21" />,
  costs: <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1 1.6 2.8 2c1.8.4 2.8.9 2.8 2.1s-1.1 2.1-2.8 2.1c-1.4 0-2.4-.5-3-1.4 M12 6v2 M12 16v2" />,
  categories: <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" />,
  tables: <path d="M3 8.5h18v3H3z M6 11.5V20 M18 11.5V20 M9 4.5h6" />,
  zones: <path d="M12 21s7-6 7-11.5a7 7 0 0 0-14 0C5 15 12 21 12 21z M12 9.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0" />,
  hours: <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3.5 2" />,
  deliveries: <path d="M5.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M18.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M8 17h5.5l3-7h-4 M13 10V6h3" />,
  settle: <path d="M3 7h18v10H3z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M6.5 10v4 M17.5 10v4" />,
  business: <path d="M4 20V11 M10 20V4 M16 20v-7 M2.5 20h19" />,
  payment: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3.5 M3 7.5V18a2 2 0 0 0 2 2h15V8.5H5.5A2.5 2.5 0 0 1 3 7.5z M16.5 14.2h.01" />,
  brand: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />,
  team: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16.5 11a2.7 2.7 0 1 0 0-5.4 M18 14.3c1.8.8 3 2.5 3 5.7" />,
  plan: <path d="M3 6h18v12H3z M3 10.5h18 M6.5 15h3" />,
  subscriptions: <path d="M5 6h14 M5 12h14 M5 18h9" />,
  help: <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0 M5.6 5.6l3.9 3.9 M14.5 14.5l3.9 3.9 M18.4 5.6l-3.9 3.9 M9.5 14.5l-3.9 3.9" />,
  kitchen: <path d="M6.5 14V9.5a3.5 3.5 0 0 1 2.2-3.2A3.5 3.5 0 0 1 12 4a3.5 3.5 0 0 1 3.3 2.3 3.5 3.5 0 0 1 2.2 3.2V14 M6.5 14V20h11v-6 M9.5 17h5" />,
  waiter: <path d="M3.5 17.5h17 M5.5 17.5a6.5 6.5 0 0 1 13 0 M12 8V5.5 M10 5.5h4" />,
  cashier: <path d="M5 11h14v8.5H5z M8 11V5h8v6 M8.5 14.5h2 M13.5 14.5h2" />,
  courier: <path d="M5.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M18.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M8 17h5l2-6h3 M12 11H8l-1-3.5H4.5" />,
  approvals: <path d="M12 3l7 3v5c0 4.5-2.9 8.2-7 10-4.1-1.8-7-5.5-7-10V6z M8.8 12l2.4 2.4 4.2-4.6" />,
  sales: <path d="M3 17l6-6 4 4 8-8 M15 7h6v6" />,
  customer: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />,
  owner: <path d="M4 20V10l8-6 8 6v10 M9 20v-6h6v6 M3 10.5 12 4l9 6.5" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  logout: <path d="M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9" />,
  guide: <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2-2.5 3.7 M12 17.2h.01" />,
  phone: <path d="M6.5 3.5h3l1.5 4-2.1 1.5a11 11 0 0 0 6.1 6.1L16.5 13l4 1.5v3a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />,
  qr: <path d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M18 14h2v2 M14 18.5h2 M18.5 18.5h1.5V20 M17.5 17.5v0" />,
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .8-.4l.8-1.2A1 1 0 0 1 10.1 4h3.8a1 1 0 0 1 .8.4l.8 1.2a1 1 0 0 0 .8.4h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4 17 5-4.5 3.5 3 3-2.5L20 16" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  chat: <path d="M5 18.5 6.2 15A7.5 7.5 0 1 1 9 17.8L5 18.5Z" />,
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
