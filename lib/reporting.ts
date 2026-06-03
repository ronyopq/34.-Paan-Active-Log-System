import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/format";
import { ActivityAttachment, ActivityEntry, OrgSettings } from "@/lib/types";

type ExportValue = string | number;
type ExportRow = Record<string, ExportValue>;

export type ReportFilters = {
  project: string;
  activityName: string;
  district: string;
  upazila: string;
  union: string;
  dateFrom: string;
  dateTo: string;
  status?: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildFilterList = (filters: ReportFilters) => {
  const rows = [
    filters.project ? `Project: ${filters.project}` : "",
    filters.activityName ? `Activity: ${filters.activityName}` : "",
    filters.district ? `District: ${filters.district}` : "",
    filters.upazila ? `Upazila: ${filters.upazila}` : "",
    filters.union ? `Union: ${filters.union}` : "",
    filters.status ? `Status: ${filters.status}` : "",
    filters.dateFrom ? `From: ${formatDate(filters.dateFrom)}` : "",
    filters.dateTo ? `To: ${formatDate(filters.dateTo)}` : ""
  ].filter(Boolean);

  return rows.length ? rows : ["All activities"];
};

export const filterEntriesByReportFilters = (entries: ActivityEntry[], filters: ReportFilters) =>
  entries.filter((entry) => {
    const matchesProject = !filters.project || entry.project === filters.project;
    const matchesActivity = !filters.activityName || entry.activityName === filters.activityName;
    const matchesDistrict = !filters.district || entry.district === filters.district;
    const matchesUpazila = !filters.upazila || entry.upazila === filters.upazila;
    const matchesUnion = !filters.union || entry.union === filters.union;
    const matchesStatus = !filters.status || entry.status === filters.status;
    const matchesFrom = !filters.dateFrom || entry.date >= filters.dateFrom;
    const matchesTo = !filters.dateTo || entry.date <= filters.dateTo;

    return (
      matchesProject &&
      matchesActivity &&
      matchesDistrict &&
      matchesUpazila &&
      matchesUnion &&
      matchesStatus &&
      matchesFrom &&
      matchesTo
    );
  });

export const summarizeEntries = (entries: ActivityEntry[]) => {
  const totalActivities = entries.length;
  const totalParticipants = entries.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalBudget = entries.reduce((sum, entry) => sum + entry.totalBudget, 0);
  const totalExpenses = entries.reduce((sum, entry) => sum + entry.totalExpenses, 0);
  const totalAttachments = entries.reduce((sum, entry) => sum + entry.attachments.length, 0);
  const totalProjects = new Set(entries.map((entry) => entry.project)).size;

  return {
    totalActivities,
    totalParticipants,
    totalBudget,
    totalExpenses,
    totalAttachments,
    totalProjects
  };
};

export const entryExportHeaders = [
  "ID",
  "Status",
  "Date",
  "Project",
  "Activity",
  "ActivityCode",
  "ActivityType",
  "District",
  "Upazila",
  "Union",
  "Venue",
  "ImplementedBy",
  "Participants",
  "Male",
  "Female",
  "Budget",
  "Expenses",
  "VariancePercent",
  "ReferenceLinks",
  "Notes",
  "AIReport",
  "AttachmentCount",
  "AttachmentNames",
  "AttachmentLinks",
  "ImageLinks",
  "DocumentLinks",
  "ImageNames",
  "DocumentNames",
  "CreatedBy",
  "CreatedAt",
  "UpdatedAt",
  "SubmittedAt",
  "ReviewedBy",
  "ReviewedAt"
] as const;

const participantMetricHeaders = ["Male", "Female", "Total"] as const;

export const attachmentExportHeaders = [
  "EntryID",
  "Date",
  "Project",
  "Activity",
  "District",
  "Upazila",
  "Union",
  "FileCategory",
  "FileName",
  "FileType",
  "FileSizeKB",
  "FileLink",
  "ReferenceLinks"
] as const;

const toAttachmentSummary = (entry: ActivityEntry, kind?: "image" | "document") =>
  entry.attachments
    .filter((file) => (kind ? file.type === kind : true))
    .map((file) => `${file.name} (${file.category})`)
    .join(" | ");

const getBrowserOrigin = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

const getPublicFileBaseUrl = () => (process.env.NEXT_PUBLIC_FILE_BASE_URL || "").trim().replace(/\/+$/g, "");

const getProxyFileId = (value: string) => {
  const link = String(value || "").trim();
  if (!link.includes("/api/file")) return "";

  try {
    const parsed = new URL(link, getBrowserOrigin() || "http://localhost");
    return parsed.searchParams.get("id") || "";
  } catch {
    return "";
  }
};

const toAbsoluteUrl = (value: string) => {
  const link = String(value || "").trim();
  if (!link || link === "#") return "";
  if (/^(https?:|data:|blob:)/i.test(link)) return link;

  const origin = getBrowserOrigin();
  if (!origin) return link;

  try {
    return new URL(link, origin).href;
  } catch {
    return link;
  }
};

const getAttachmentExportLink = (file: ActivityAttachment) => {
  if (file.directUrl) return toAbsoluteUrl(file.directUrl);

  const publicFileBaseUrl = getPublicFileBaseUrl();
  const proxyFileId = getProxyFileId(file.url);
  if (publicFileBaseUrl && proxyFileId) {
    return `${publicFileBaseUrl}/${encodeURIComponent(proxyFileId)}`;
  }

  return toAbsoluteUrl(file.url);
};

const toAttachmentLinks = (entry: ActivityEntry, kind?: "image" | "document") =>
  entry.attachments
    .filter((file) => (kind ? file.type === kind : true))
    .map((file) => getAttachmentExportLink(file))
    .filter(Boolean)
    .join(" | ");

const toReferenceLinks = (value: string) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" | ");

const getParticipantCategoryLabels = (entries: ActivityEntry[]) =>
  Array.from(
    new Set(
      entries.flatMap((entry) =>
        entry.participants.map((line) => line.categoryLabel || line.categoryKey).filter(Boolean)
      )
    )
  );

const getParticipantExportHeader = (label: string, metric: (typeof participantMetricHeaders)[number]) =>
  `Participant - ${label} ${metric}`;

export const buildEntryExportHeaders = (entries: ActivityEntry[]) => [
  ...entryExportHeaders,
  ...getParticipantCategoryLabels(entries).flatMap((label) =>
    participantMetricHeaders.map((metric) => getParticipantExportHeader(label, metric))
  )
];

export const buildEntryExportRows = (entries: ActivityEntry[]): ExportRow[] => {
  const participantLabels = getParticipantCategoryLabels(entries);

  return entries.map((entry) => {
    const row: ExportRow = {
      ID: entry.uniqueId,
      Status: entry.status,
      Date: formatDate(entry.date),
      Project: entry.project,
      Activity: entry.activityName,
      ActivityCode: entry.activityCode,
      ActivityType: entry.activityType,
      District: entry.district,
      Upazila: entry.upazila,
      Union: entry.union,
      Venue: entry.venue,
      ImplementedBy: entry.implementedBy,
      Participants: entry.grandTotal,
      Male: entry.totalMale,
      Female: entry.totalFemale,
      Budget: entry.totalBudget,
      Expenses: entry.totalExpenses,
      VariancePercent: Number(entry.variance.toFixed(2)),
      ReferenceLinks: toReferenceLinks(entry.referenceLink),
      Notes: entry.notes,
      AIReport: entry.aiReport,
      AttachmentCount: entry.attachments.length,
      AttachmentNames: toAttachmentSummary(entry),
      AttachmentLinks: toAttachmentLinks(entry),
      ImageLinks: toAttachmentLinks(entry, "image"),
      DocumentLinks: toAttachmentLinks(entry, "document"),
      ImageNames: toAttachmentSummary(entry, "image"),
      DocumentNames: toAttachmentSummary(entry, "document"),
      CreatedBy: entry.createdBy,
      CreatedAt: entry.createdAt,
      UpdatedAt: entry.updatedAt,
      SubmittedAt: entry.submittedAt || "",
      ReviewedBy: entry.reviewedBy || "",
      ReviewedAt: entry.reviewedAt || ""
    };

    participantLabels.forEach((label) => {
      const matchingRows = entry.participants.filter((line) => (line.categoryLabel || line.categoryKey) === label);
      const male = matchingRows.reduce((sum, line) => sum + line.male, 0);
      const female = matchingRows.reduce((sum, line) => sum + line.female, 0);
      row[getParticipantExportHeader(label, "Male")] = male;
      row[getParticipantExportHeader(label, "Female")] = female;
      row[getParticipantExportHeader(label, "Total")] = male + female;
    });

    return row;
  });
};

export const buildAttachmentExportRows = (entries: ActivityEntry[]) =>
  entries.flatMap((entry) =>
    entry.attachments.map((file) => ({
      EntryID: entry.uniqueId,
      Date: formatDate(entry.date),
      Project: entry.project,
      Activity: entry.activityName,
      District: entry.district,
      Upazila: entry.upazila,
      Union: entry.union,
      FileCategory: file.category,
      FileName: file.name,
      FileType: file.type,
      FileSizeKB: file.sizeKb,
      FileLink: getAttachmentExportLink(file),
      ReferenceLinks: toReferenceLinks(entry.referenceLink)
    }))
  );

const buildReportFileName = (prefix: string) => {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");
  return `${prefix}-${stamp}`;
};

const escapeCsvValue = (value: string | number) => {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
};

export const exportEntriesToCsv = (
  entries: ActivityEntry[],
  fileName = `${buildReportFileName("praan-export")}.csv`
) => {
  const rows = buildEntryExportRows(entries);
  const headers = buildEntryExportHeaders(entries);
  const csv = [
    headers,
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header] ?? ""))
    )
  ]
    .map((line) => line.join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportEntriesReportToExcel = (
  entries: ActivityEntry[],
  filters: ReportFilters,
  orgSettings?: OrgSettings,
  fileName = `${buildReportFileName("praan-report")}.xlsx`
) => {
  const workbook = XLSX.utils.book_new();

  const infoSheet = XLSX.utils.json_to_sheet(
    [
      ...(orgSettings ? [
        { Field: "Organization", Value: orgSettings.orgName },
        ...(orgSettings.orgAddress ? [{ Field: "Address", Value: orgSettings.orgAddress }] : []),
        ...(orgSettings.orgPhone ? [{ Field: "Phone", Value: orgSettings.orgPhone }] : []),
        ...(orgSettings.orgEmail ? [{ Field: "Email", Value: orgSettings.orgEmail }] : []),
      ] : []),
      { Field: "Report", Value: "Activity Report" },
      { Field: "Generated", Value: new Date().toLocaleString("en-GB") },
      ...buildFilterList(filters).map((label) => ({ Field: "Filter", Value: label }))
    ]
  );
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Info");

  const dataSheet = XLSX.utils.json_to_sheet(buildEntryExportRows(entries), {
    header: buildEntryExportHeaders(entries)
  });
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Activities");

  const attachmentSheet = XLSX.utils.json_to_sheet(buildAttachmentExportRows(entries), {
    header: [...attachmentExportHeaders]
  });
  XLSX.utils.book_append_sheet(workbook, attachmentSheet, "Attachments");

  XLSX.writeFile(workbook, fileName);
};

const getBase64Image = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const exportEntriesReportToPdf = async (
  entries: ActivityEntry[],
  filters: ReportFilters,
  orgSettings?: OrgSettings
) => {
  const orgName = orgSettings?.orgName || "PRAAN";
  const summary = summarizeEntries(entries);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 42;
  let y = 48;

  const ensureSpace = (required = 24) => {
    if (y + required < pageHeight - 42) return;
    doc.addPage();
    y = 48;
  };

  // Header block with logo + org name + address
  doc.setFillColor(15, 79, 168);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, orgSettings?.orgAddress ? 78 : 58, 16, 16, "F");

  let logoX = marginX + 18;
  if (orgSettings?.logoUrl) {
    try {
      const logoBase64 = await getBase64Image(orgSettings.logoUrl);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", marginX + 14, y + 10, 32, 32);
        logoX = marginX + 58;
      }
    } catch {
      // fallback — no logo
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${orgName} Activity Report`, logoX, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleString("en-GB")}`, logoX, y + 42);

  if (orgSettings?.orgAddress || orgSettings?.orgPhone || orgSettings?.orgEmail) {
    const details = [orgSettings.orgAddress, orgSettings.orgPhone, orgSettings.orgEmail].filter(Boolean).join(" | ");
    doc.setFontSize(9);
    doc.text(details, logoX, y + 56);
    y += 102;
  } else {
    y += 82;
  }

  doc.setTextColor(16, 38, 63);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Applied Filters", marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  buildFilterList(filters).forEach((row) => {
    ensureSpace(18);
    doc.text(`- ${row}`, marginX + 6, y);
    y += 14;
  });

  y += 10;
  const summaryBlocks = [
    `Activities: ${summary.totalActivities}`,
    `Participants: ${summary.totalParticipants}`,
    `Projects: ${summary.totalProjects}`,
    `Attachments: ${summary.totalAttachments}`,
    `Budget: ${formatCurrency(summary.totalBudget)}`,
    `Expenses: ${formatCurrency(summary.totalExpenses)}`
  ];

  summaryBlocks.forEach((label, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = marginX + col * ((pageWidth - marginX * 2 - 18) / 2);
    const blockWidth = (pageWidth - marginX * 2 - 18) / 2;
    const blockY = y + row * 50;
    doc.setFillColor(247, 250, 255);
    doc.setDrawColor(199, 215, 234);
    doc.roundedRect(x, blockY, blockWidth, 40, 12, 12, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, x + 14, blockY + 24);
  });
  y += 162;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Activity Rows", marginX, y);
  y += 18;

  entries.forEach((entry) => {
    ensureSpace(78);
    doc.setDrawColor(220, 228, 238);
    doc.roundedRect(marginX, y - 2, pageWidth - marginX * 2, 68, 12, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${entry.uniqueId} | ${formatDate(entry.date)} | ${entry.status}`, marginX + 12, y + 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(
      `${entry.project} - ${entry.activityName}`,
      pageWidth - marginX * 2 - 24
    );
    doc.text(titleLines, marginX + 12, y + 32);

    const metaLine = `${entry.district} > ${entry.upazila} > ${entry.union} | Participants: ${entry.grandTotal} | Budget: ${formatCurrency(entry.totalBudget)} | Expenses: ${formatCurrency(entry.totalExpenses)}`;
    const metaLines = doc.splitTextToSize(metaLine, pageWidth - marginX * 2 - 24);
    doc.text(metaLines, marginX + 12, y + 48);

    y += 82;
  });

  doc.save(`${buildReportFileName("praan-report")}.pdf`);
};

export const printEntriesReport = (
  entries: ActivityEntry[],
  filters: ReportFilters,
  orgSettings?: OrgSettings
) => {
  const orgName = orgSettings?.orgName || "PRAAN";
  const summary = summarizeEntries(entries);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1140,height=980");

  if (!printWindow) {
    console.warn("Popup blocked. Please allow popups to print the report.");
    return;
  }

  const orgDetails = [orgSettings?.orgAddress, orgSettings?.orgPhone, orgSettings?.orgEmail].filter(Boolean).join(" | ");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(orgName)} Activity Report</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        color: #10263f;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #ffffff;
      }
      h1, h2 {
        margin: 0 0 10px;
      }
      .hero {
        border: 1px solid #c7d7ea;
        border-radius: 18px;
        background: #f7faff;
        padding: 20px;
        margin-bottom: 18px;
      }
      .hero-logo {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .hero-logo img {
        width: 48px;
        height: 48px;
        object-fit: contain;
        border-radius: 8px;
      }
      .meta {
        color: #52657f;
        font-size: 13px;
      }
      .org-details {
        color: #52657f;
        font-size: 12px;
        margin-top: 4px;
      }
      .filters,
      .summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 18px 0;
      }
      .chip {
        border: 1px solid #dbe5f0;
        border-radius: 12px;
        padding: 10px 12px;
        background: #ffffff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th,
      td {
        border: 1px solid #dbe5f0;
        padding: 10px;
        text-align: left;
        font-size: 12px;
        vertical-align: top;
      }
      th {
        background: #edf2f8;
      }
      @media print {
        body {
          padding: 12mm;
        }
      }
    </style>
  </head>
  <body>
    <section class="hero">
      ${orgSettings?.logoUrl ? `<div class="hero-logo"><img src="${escapeHtml(orgSettings.logoUrl)}" alt="Logo" /></div>` : ""}
      <h1>${escapeHtml(orgName)} Activity Report</h1>
      <div class="meta">Generated on ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
      ${orgDetails ? `<div class="org-details">${escapeHtml(orgDetails)}</div>` : ""}
    </section>

    <h2>Applied Filters</h2>
    <section class="filters">
      ${buildFilterList(filters)
        .map((label) => `<div class="chip">${escapeHtml(label)}</div>`)
        .join("")}
    </section>

    <h2>Summary</h2>
    <section class="summary">
      <div class="chip">Activities: ${summary.totalActivities}</div>
      <div class="chip">Participants: ${summary.totalParticipants}</div>
      <div class="chip">Projects: ${summary.totalProjects}</div>
      <div class="chip">Attachments: ${summary.totalAttachments}</div>
      <div class="chip">Budget: ${escapeHtml(formatCurrency(summary.totalBudget))}</div>
      <div class="chip">Expenses: ${escapeHtml(formatCurrency(summary.totalExpenses))}</div>
    </section>

    <h2>Activity Rows</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Date</th>
          <th>Project / Activity</th>
          <th>Location</th>
          <th>Participants</th>
          <th>Budget / Expenses</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `<tr>
              <td>${escapeHtml(entry.uniqueId)}</td>
              <td>${escapeHtml(formatDate(entry.date))}</td>
              <td>${escapeHtml(entry.project)}<br />${escapeHtml(entry.activityName)}</td>
              <td>${escapeHtml(`${entry.district} > ${entry.upazila} > ${entry.union}`)}</td>
              <td>${entry.grandTotal} (${entry.totalMale}M / ${entry.totalFemale}F)</td>
              <td>${escapeHtml(formatCurrency(entry.totalBudget))}<br />${escapeHtml(
                formatCurrency(entry.totalExpenses)
              )}</td>
              <td>${escapeHtml(entry.status)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
