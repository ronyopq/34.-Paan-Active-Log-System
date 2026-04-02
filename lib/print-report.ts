import { ActivityEntry, PrintSetup } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { jsPDF } from "jspdf";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const openTextPrintWindow = (title: string, content: string) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=980");
  if (!printWindow) {
    console.warn("Popup blocked. Please allow popups to print the report.");
    return;
  }

  const escapedTitle = escapeHtml(title);
  const escapedContent = escapeHtml(content);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle}</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        padding: 24px;
        margin: 0;
        color: #1f2937;
        background: #ffffff;
      }
      h1 {
        font-size: 22px;
        margin: 0 0 14px;
      }
      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 13px;
        line-height: 1.52;
        margin: 0;
      }
      @media print {
        body {
          padding: 14mm;
        }
      }
    </style>
  </head>
  <body>
    <h1>${escapedTitle}</h1>
    <pre>${escapedContent}</pre>
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

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const buildEntryTextReport = (entry: ActivityEntry) => {
  const nonZeroParticipants = entry.participants.filter((line) => line.male + line.female > 0);
  const participantLines = nonZeroParticipants.length
    ? [
        "Category                        Male     Female   Total",
        "---------------------------------------------------------",
        ...nonZeroParticipants.map((line) => {
          const category = line.categoryLabel.padEnd(30, " ").slice(0, 30);
          const male = String(line.male).padEnd(8, " ");
          const female = String(line.female).padEnd(9, " ");
          const total = String(line.male + line.female);
          return `${category}${male}${female}${total}`;
        }),
        "---------------------------------------------------------",
        `Total                           ${String(entry.totalMale).padEnd(8, " ")}${String(entry.totalFemale).padEnd(9, " ")}${entry.grandTotal}`
      ].join("\n")
    : "No participant rows with value greater than zero.";

  const attachmentLines = entry.attachments.length
    ? entry.attachments
        .map(
          (file, index) =>
            `${index + 1}. ${file.name} | Category: ${file.category} | Type: ${file.type} | Size: ${file.sizeKb} KB`
        )
        .join("\n")
    : "No attachments uploaded.";

  const firstFourPhotos = entry.attachments.filter((file) => file.type === "image").slice(0, 4);
  const photoGrid = firstFourPhotos.length
    ? [
        `${firstFourPhotos[0] ? `[1] ${firstFourPhotos[0].name}` : "[1] -"}`.padEnd(52, " ") +
          `${firstFourPhotos[1] ? `[2] ${firstFourPhotos[1].name}` : "[2] -"}`,
        `${firstFourPhotos[2] ? `[3] ${firstFourPhotos[2].name}` : "[3] -"}`.padEnd(52, " ") +
          `${firstFourPhotos[3] ? `[4] ${firstFourPhotos[3].name}` : "[4] -"}`
      ].join("\n")
    : "No photo files available for preview.";

  return [
    "PRAAN ACTIVITY REPORT (TEXT VERSION)",
    "Based on approved DOCX reporting format",
    "",
    "Organization: PRAAN",
    "",
    "SECTION 1: FORM OVERVIEW",
    `Date: ${formatDate(entry.date)}`,
    `Project Name: ${entry.project}`,
    `Activity Name: ${entry.activityName}`,
    `Activity Code: ${entry.activityCode}`,
    `District: ${entry.district}`,
    `Upazila: ${entry.upazila}`,
    `Union: ${entry.union}`,
    `Venue: ${entry.venue}`,
    `Implemented By: ${entry.implementedBy}`,
    "",
    `Unique ID: ${entry.uniqueId}`,
    `Status: ${entry.status}`,
    `Activity Type: ${entry.activityType}`,
    `Submitted By: ${entry.createdBy}`,
    `Reference Link: ${entry.referenceLink || "-"}`,
    "",
    "SECTION 2: NARRATIVE REPORT",
    entry.aiReport || "-",
    "",
    "SECTION 3: NOTES",
    entry.notes || "-",
    "",
    "SECTION 4: PARTICIPANTS (TABLE STYLE)",
    participantLines,
    "",
    "SECTION 5: FINANCIAL",
    `Budget: ${formatCurrency(entry.totalBudget)}`,
    `Expenses: ${formatCurrency(entry.totalExpenses)}`,
    `Variance: ${entry.variance.toFixed(1)}%`,
    "",
    "SECTION 6: FILES & ATTACHMENTS",
    attachmentLines,
    "",
    `Total Attachments: ${entry.attachments.length}`,
    "",
    `SECTION 7: SOME PICTURES FROM "${entry.activityName}"`,
    "First 4 pictures shown in 2-column text layout:",
    photoGrid,
    "",
    "SECTION 8: REPORT PREPARED BY",
    `Name: ${entry.createdBy}`,
    `Designation: ${entry.implementedBy}`,
    `Date: ${entry.submittedAt ? formatDate(entry.submittedAt) : formatDate(entry.createdAt)}`,
    "",
    `Submitted At: ${entry.submittedAt ? formatDateTime(entry.submittedAt) : "Not submitted"}`
  ].join("\n");
};

export const printEntryTextReport = (entry: ActivityEntry) => {
  openTextPrintWindow(`PRAAN Text Report - ${entry.uniqueId}`, buildEntryTextReport(entry));
};

export const exportEntryDocxReport = (entry: ActivityEntry) => {
  const content = buildEntryTextReport(entry);
  const blob = new Blob([content], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  downloadBlob(`${entry.uniqueId}-report.docx`, blob);
};

/**
 * Helper to get images as base64 for jsPDF
 */
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
  } catch (e) {
    return null;
  }
};

/**
 * 1. Standard Formal PDF
 */
export const exportStandardPdf = (entry: ActivityEntry) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;

  // Header
  doc.setFillColor(13, 110, 253);
  doc.rect(0, 0, 600, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PRAAN - FORMAL ACTIVITY REPORT", 40, 25);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y = 70;

  const data = [
    ["ID", entry.uniqueId, "Status", entry.status],
    ["Project", entry.project, "Date", formatDate(entry.date)],
    ["Activity", entry.activityName, "Code", entry.activityCode],
    ["Location", `${entry.district} > ${entry.upazila} > ${entry.union}`, "Venue", entry.venue],
    ["Budget", formatCurrency(entry.totalBudget), "Expenses", formatCurrency(entry.totalExpenses)],
    ["Male", String(entry.totalMale), "Female", String(entry.totalFemale)]
  ];

  data.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0], 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[1], 110, y);
    doc.setFont("helvetica", "bold");
    doc.text(row[2], 300, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[3], 380, y);
    y += 20;
  });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Narrative Summary:", 40, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  const narrative = doc.splitTextToSize(entry.aiReport || "No summary available.", 520);
  doc.text(narrative, 40, y);
  y += narrative.length * 12 + 20;

  doc.save(`${entry.uniqueId}-formal.pdf`);
};

/**
 * 2. Executive Comprehensive PDF
 */
export const exportExecutivePdf = (entry: ActivityEntry) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 60;

  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text("EXECUTIVE ACTIVITY SUMMARY", 40, y);
  y += 10;
  doc.setLineWidth(2);
  doc.line(40, y, 550, y);
  y += 25;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Activity: ${entry.activityName}`, 40, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.text(`Project: ${entry.project} | Code: ${entry.activityCode} | Type: ${entry.activityType}`, 40, y);
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.text("Financial Performance:", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.text(`Allocated Budget: ${formatCurrency(entry.totalBudget)}`, 50, y);
  y += 15;
  doc.text(`Actual Expenses: ${formatCurrency(entry.totalExpenses)}`, 50, y);
  y += 15;
  doc.text(`Budget Variance: ${entry.variance.toFixed(2)}%`, 50, y);
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.text("Participant Metrics:", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.text(`Total Attendance: ${entry.grandTotal}`, 50, y);
  y += 15;
  doc.text(`Male: ${entry.totalMale} | Female: ${entry.totalFemale}`, 50, y);
  
  y += 40;
  doc.setFont("helvetica", "italic");
  doc.text("Notes/Observations:", 40, y);
  y += 15;
  const notes = doc.splitTextToSize(entry.notes || "N/A", 500);
  doc.text(notes, 40, y);

  doc.save(`${entry.uniqueId}-executive.pdf`);
};

/**
 * 3. Photo Highlight Report (4 Photos at end)
 */
export const exportPhotoPdf = async (entry: ActivityEntry) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  
  // Basic info on page 1
  doc.setFontSize(14);
  doc.text(`PHOTO REPORT: ${entry.activityName}`, 40, 50);
  doc.setFontSize(10);
  doc.text(`ID: ${entry.uniqueId} | Date: ${formatDate(entry.date)} | Location: ${entry.district}`, 40, 70);
  
  const narrative = doc.splitTextToSize(entry.aiReport || "", 520);
  doc.text(narrative, 40, 100);

  // Photos on Page 2 or at end
  const photos = entry.attachments.filter(a => a.type === 'image').slice(0, 4);
  
  if (photos.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text("ACTIVITY PHOTO GALLERY (LIMIT 4)", 40, 40);
    
    let px = 40;
    let py = 60;
    const imgWidth = 240;
    const imgHeight = 180;

    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const base64 = await getBase64Image(photo.url);
        if (base64) {
            doc.addImage(base64, "JPEG", px, py, imgWidth, imgHeight);
            doc.setFontSize(8);
            doc.text(photo.name, px, py + imgHeight + 12);
        }

        // Grid logic (2x2)
        if (i % 2 === 0) {
            px += imgWidth + 20;
        } else {
            px = 40;
            py += imgHeight + 40;
        }
    }
  }

  doc.save(`${entry.uniqueId}-photos.pdf`);
};

export const exportEntryPdfReport = (entry: ActivityEntry) => {
  // Fallback to standard
  exportStandardPdf(entry);
};

export const printTemplatePreview = (setup: PrintSetup, templateName: string) => {
  const report = [
    "PRINT TEMPLATE PREVIEW",
    `Template: ${templateName}`,
    `Preset: ${setup.preset}`,
    `Page Size: ${setup.pageSize}`,
    `Orientation: ${setup.orientation}`,
    `Header: ${setup.header}`,
    `Footer: ${setup.footer}`,
    "",
    "SECTION 1: OVERVIEW",
    "Date: [dd/mm/yyyy]",
    "Project: [project name]",
    "Activity: [activity title]",
    "Location: [district > upazila > union]",
    "",
    "SECTION 2: PARTICIPANTS",
    "Male: [count]",
    "Female: [count]",
    "Total: [count]",
    "",
    "SECTION 3: FINANCIAL",
    "Budget: [value]",
    "Expenses: [value]",
    "Variance: [value]%",
    "",
    "SECTION 4: FILES & ATTACHMENTS",
    "1. [file name and category]",
    "2. [file name and category]"
  ].join("\n");

  openTextPrintWindow("PRAAN Print Setup Preview", report);
};
