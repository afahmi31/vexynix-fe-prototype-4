import type { Role } from "@/types/api";

/** Matches the shape sidebar-nav/top-menu-nav already accept for children. */
export interface MenuItemChild {
  path: string;
  title: string;
}

export interface MenuItem {
  path?: string;
  icon?: string;
  title?: string;
  is_header?: boolean;
  is_divider?: boolean;
  children?: MenuItemChild[];
}

const playerMenu: MenuItem[] = [
  { is_header: true, title: "Games" },
  { path: "/lobby", icon: "fa-solid fa-dice", title: "Games" },
  { path: "/wallet/deposit", icon: "fa-solid fa-wallet", title: "Deposit" },
  { path: "/wallet/withdraw", icon: "fa-solid fa-money-bill-transfer", title: "Withdraw" },
  { is_header: true, title: "Account" },
  { path: "/account", icon: "fa-solid fa-user-gear", title: "My Account" },
];

/**
 * Merchant admin nav (P7.1). All sections of /admin/merchant/* — later P7
 * batches replace the placeholder pages with the real implementations.
 */
const merchantAdminMenu: MenuItem[] = [
  { is_header: true, title: "Merchant Admin" },
  { path: "/admin/merchant", icon: "fa fa-gauge-high", title: "Dashboard" },
  { path: "/admin/merchant/players", icon: "fa fa-users", title: "Players" },
  { path: "/admin/merchant/approvals", icon: "fa fa-clipboard-check", title: "Approvals" },
  { path: "/admin/merchant/payouts", icon: "fa fa-money-bill-transfer", title: "Payouts" },
  { path: "/admin/merchant/gateways", icon: "fa fa-plug", title: "Gateways" },
  { path: "/admin/merchant/currencies", icon: "fa fa-coins", title: "Currencies" },
  { path: "/admin/merchant/vendors", icon: "fa fa-puzzle-piece", title: "Vendors" },
  { path: "/admin/merchant/recon", icon: "fa fa-scale-balanced", title: "Recon" },
  { path: "/admin/merchant/reports", icon: "fa fa-chart-line", title: "Reports" },
  { path: "/admin/merchant/brand", icon: "fa fa-palette", title: "Brand" },
  { is_divider: true },
  { is_header: true, title: "Player Area" },
  { path: "/lobby", icon: "fa fa-gamepad", title: "Lobby" },
];

/**
 * Nav items hide when out of role (P7.1): the sidebar renders only the menu
 * for the session's role. Unknown roles fall back to the player menu.
 */
export function getMenuForRole(role: Role): MenuItem[] {
  if (role === "merchant_admin") {
    return merchantAdminMenu;
  }
  return playerMenu;
}

export default playerMenu;
