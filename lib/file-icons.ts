const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"]);

export const isImageFileName = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return imageExtensions.has(extension);
};

export const getFileIconClass = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  if (extension === "pdf") return "bi-file-earmark-pdf-fill";
  if (extension === "doc" || extension === "docx") return "bi-file-earmark-word-fill";
  if (extension === "xls" || extension === "xlsx") return "bi-file-earmark-spreadsheet-fill";
  if (extension === "csv") return "bi-filetype-csv";
  if (extension === "ppt" || extension === "pptx") return "bi-file-earmark-slides-fill";
  if (extension === "zip" || extension === "rar" || extension === "7z") return "bi-file-earmark-zip-fill";
  if (extension === "txt" || extension === "rtf") return "bi-file-earmark-text-fill";
  if (isImageFileName(fileName)) return "bi-file-earmark-image-fill";
  return "bi-file-earmark-fill";
};
