import type { IconName } from "./navLogic";

/**
 * Small line icons for the menu and the big buttons. Drawn here (24 x 24, one stroke) so nothing is downloaded and
 * the colour follows the text. They never carry the meaning alone: every one sits next to a written label.
 */
const PATHS: Record<IconName | "menu" | "close" | "chevron" | "logout" | "guide" | "store" | "qr", string> = {
  home: "M3 11.5 12 4l9 7.5 M5.5 10v10h13V10 M10 20v-5.5h4V20",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3",
  assistant: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21 M9 21h6",
  products: "M7 3v7 M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3 M7 10.5V21 M17 3c-2.2 1.2-3 3.4-3 6 0 2.2 1.2 3.6 3 3.6V21",
  costs: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1 1.6 2.8 2c1.8.4 2.8.9 2.8 2.1s-1.1 2.1-2.8 2.1c-1.4 0-2.4-.5-3-1.4 M12 6v2 M12 16v2",
  categories: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  tables: "M3 8.5h18v3H3z M6 11.5V20 M18 11.5V20 M9 4.5h6",
  zones: "M12 21s7-6 7-11.5a7 7 0 0 0-14 0C5 15 12 21 12 21z M12 9.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  hours: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3.5 2",
  deliveries: "M5.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M18.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M8 17h5.5l3-7h-4 M13 10V6h3",
  settle: "M3 7h18v10H3z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M6.5 10v4 M17.5 10v4",
  business: "M4 20V11 M10 20V4 M16 20v-7 M2.5 20h19",
  payment: "M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3.5 M3 7.5V18a2 2 0 0 0 2 2h15V8.5H5.5A2.5 2.5 0 0 1 3 7.5z M16.5 14.2h.01",
  brand: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  team: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16.5 11a2.7 2.7 0 1 0 0-5.4 M18 14.3c1.8.8 3 2.5 3 5.7",
  plan: "M3 6h18v12H3z M3 10.5h18 M6.5 15h3",
  subscriptions: "M5 6h14 M5 12h14 M5 18h9",
  help: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0 M5.6 5.6l3.9 3.9 M14.5 14.5l3.9 3.9 M18.4 5.6l-3.9 3.9 M9.5 14.5l-3.9 3.9",
  kitchen: "M6.5 14V9.5a3.5 3.5 0 0 1 2.2-3.2A3.5 3.5 0 0 1 12 4a3.5 3.5 0 0 1 3.3 2.3 3.5 3.5 0 0 1 2.2 3.2V14 M6.5 14V20h11v-6 M9.5 17h5",
  waiter: "M3.5 17.5h17 M5.5 17.5a6.5 6.5 0 0 1 13 0 M12 8V5.5 M10 5.5h4",
  cashier: "M5 11h14v8.5H5z M8 11V5h8v6 M8.5 14.5h2 M13.5 14.5h2",
  courier: "M5.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M18.5 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M8 17h5l2-6h3 M12 11H8l-1-3.5H4.5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  approvals: "M12 3l7 3v5c0 4.5-2.9 8.2-7 10-4.1-1.8-7-5.5-7-10V6z M8.8 12l2.4 2.4 4.2-4.6",
  customer: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5",
  owner: "M4 20V10l8-6 8 6v10 M9 20v-6h6v6 M3 10.5 12 4l9 6.5",
  menu: "M4 6.5h16 M4 12h16 M4 17.5h16",
  close: "M6 6l12 12 M18 6 6 18",
  chevron: "M9.5 6l6 6-6 6",
  logout: "M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9",
  guide: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2-2.5 3.7 M12 17.2h.01",
  store: "M4 9.5 5.5 4h13L20 9.5 M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0 M5 12.5V20h14v-7.5",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M18 14h2v2 M14 18.5h2 M18.5 18.5h1.5V20 M17.5 17.5v0",
};

export type NavIconName = keyof typeof PATHS;

type Props = { name: NavIconName; size?: number };

export default function NavIcon({ name, size = 24 }: Props) {
  return (
    <svg
      className="nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
