export type Role = "User" | "Manager" | "Admin";
export type ThemeMode =
  | "corporate-light"
  | "corporate-dark"
  | "emerald"
  | "violet"
  | "sunset"
  | "mono";
export type EntryStatus = "Draft" | "Submitted" | "Reviewed";

export type AppUser = {
  fullName: string;
  username: string;
  email: string;
  title: string;
  password: string;
  role: Role;
  active: boolean;
  projects: string[];
};

export type ParticipantLine = {
  categoryKey: string;
  categoryLabel: string;
  male: number;
  female: number;
};

export type AttachmentCategory =
  | "Implementation Plan"
  | "Participants List"
  | "Press Release"
  | "Activity Report"
  | "Bill Voucher"
  | "Photos";

export type ActivityAttachment = {
  id: string;
  category: AttachmentCategory;
  name: string;
  url: string;
  type: "image" | "document";
  sizeKb: number;
};

export type ActivityEntry = {
  uniqueId: string;
  status: EntryStatus;
  date: string;
  project: string;
  activityName: string;
  activityType: string;
  activityCode: string;
  venue: string;
  district: string;
  upazila: string;
  union: string;
  implementedBy: string;
  participants: ParticipantLine[];
  totalMale: number;
  totalFemale: number;
  grandTotal: number;
  totalBudget: number;
  totalExpenses: number;
  variance: number;
  referenceLink: string;
  notes: string;
  aiReport: string;
  attachments: ActivityAttachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type ProjectActivityMap = {
  project: string;
  locked?: boolean;
  activities: Array<{ name: string; code: string; type: string; locked?: boolean }>;
  participantCategories: Array<{ key: string; label: string }>;
};

export type OrgSettings = {
  orgName: string;
  logoUrl: string;
};

export type LocationMap = {
  district: string;
  upazilas: Array<{
    name: string;
    unions: string[];
  }>;
};

export type PrintSetup = {
  preset: string;
  pageSize: string;
  orientation: "Portrait" | "Landscape";
  header: string;
  footer: string;
};

export type ReportSettings = {
  defaultTheme: string;
  templateName: string;
  enableDocx: boolean;
  enablePdf: boolean;
  enableCsv: boolean;
  enableZip: boolean;
  printSetup: PrintSetup;
};

export type LoginLog = {
  username: string;
  loginTime: string;
  logoutTime: string;
  ipAddress: string;
  device: string;
  browser: string;
  status: "Success" | "Failed";
};

export type AuditLog = {
  actor: string;
  role: Role;
  action: string;
  module: string;
  targetId: string;
  timestamp: string;
  device: string;
  browser: string;
  notes: string;
};

export type AppNotification = {
  id: string;
  title: string;
  summary: string;
  at: string;
  unread: boolean;
  entryId?: string;
};

export type DashboardMetrics = {
  totalActivities: number;
  totalParticipants: number;
  totalBudget: number;
  projects: number;
};
