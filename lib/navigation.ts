import { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const userNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities/new", label: "New Activity", icon: "bi-plus-circle" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/profile", label: "Profile", icon: "bi-person" },
  { href: "/logs/login", label: "Login Log", icon: "bi-clock-history" }
];

const managerNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/dashboard#analytics", label: "Analytics", icon: "bi-bar-chart" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/notifications", label: "Notifications", icon: "bi-bell" },
  { href: "/logs/user", label: "User Log", icon: "bi-list-ul" },
  { href: "/profile", label: "Profile", icon: "bi-person" }
];

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-house" },
  { href: "/activities/new", label: "New Activity", icon: "bi-plus-circle" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" },
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" },
  { href: "/dashboard#analytics", label: "Analytics", icon: "bi-bar-chart" },
  { href: "/files", label: "Files", icon: "bi-folder" },
  { href: "/notifications", label: "Notifications", icon: "bi-bell" },
  { href: "/logs/user", label: "User Log", icon: "bi-list-ul" },
  { href: "/admin", label: "Settings", icon: "bi-sliders" },
  { href: "/profile", label: "Profile", icon: "bi-person" }
];

export const getNavByRole = (role: Role): NavItem[] => {
  if (role === "Admin") return adminNav;
  if (role === "Manager") return managerNav;
  return userNav;
};
