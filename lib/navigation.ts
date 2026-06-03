import { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  group?: string;
};

const userNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities/new", label: "New Activity", icon: "bi-plus-circle" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/reports", label: "Report", icon: "bi-file-earmark-bar-graph" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/profile", label: "Profile", icon: "bi-person", group: "settings" },
  { href: "/logs/login", label: "Login Log", icon: "bi-clock-history", group: "settings" }
];

const managerNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/dashboard#analytics", label: "Analytics", icon: "bi-bar-chart" },
  { href: "/reports", label: "Report", icon: "bi-file-earmark-bar-graph" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/notifications", label: "Notifications", icon: "bi-bell" },
  { href: "/logs/user", label: "User Log", icon: "bi-list-ul", group: "settings" },
  { href: "/profile", label: "Profile", icon: "bi-person", group: "settings" }
];

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities/new", label: "New Activity", icon: "bi-plus-circle" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/dashboard#analytics", label: "Analytics", icon: "bi-bar-chart" },
  { href: "/reports", label: "Report", icon: "bi-file-earmark-bar-graph" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/notifications", label: "Notifications", icon: "bi-bell" },
  { href: "/logs/user", label: "User Log", icon: "bi-list-ul", group: "settings" },
  { href: "/admin", label: "Settings", icon: "bi-sliders", group: "settings" },
  { href: "/profile", label: "Profile", icon: "bi-person", group: "settings" }
];

export const getNavByRole = (role: Role): NavItem[] => {
  if (role === "Admin") return adminNav;
  if (role === "Manager") return managerNav;
  return userNav;
};
