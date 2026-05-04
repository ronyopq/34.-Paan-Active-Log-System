"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchableOption, SearchableSelect } from "@/components/common/searchable-select";
import { useAppContext } from "@/components/providers/app-context";
import { buildAttachmentFileName, getFileExtension, getMimeExtension, replaceFileExtension } from "@/lib/attachments";
import { calcUtilization, calcVariance, formatCurrency } from "@/lib/format";
import {
  ActivityAttachment,
  ActivityEntry,
  AttachmentCategory,
  EntryStatus,
  ParticipantLine,
  ProjectActivityMap
} from "@/lib/types";
import { getFileIconClass } from "@/lib/file-icons";

const uploadCategories: AttachmentCategory[] = [
  "Implementation Plan",
  "Participants List",
  "Press Release",
  "Activity Report",
  "Bill Voucher",
  "Photos"
];
const docUploadCategories: AttachmentCategory[] = [
  "Implementation Plan",
  "Participants List",
  "Press Release",
  "Activity Report",
  "Bill Voucher"
];
const todayIso = new Date().toISOString().slice(0, 10);

type FormState = {
  date: string;
  project: string;
  activityName: string;
  activityOther: string;
  activityCode: string;
  activityType: string;
  venue: string;
  implementedBy: string;
  district: string;
  upazila: string;
  union: string;
  referenceLinks: string[];
  notes: string;
  aiReport: string;
  budget: string;
  expenses: string;
};

type UploadedItem = {
  id: string;
  attachmentId?: string;
  sequence: number;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "document";
  previewUrl: string | null;
  serverUrl: string;
  status: "preparing" | "uploading" | "uploaded" | "failed";
  progress: number;
};

type UploadApiResponse = {
  ok: boolean;
  url: string;
  name: string;
  mimeType: string;
  type: "image" | "document";
  sizeKb: number;
  message?: string;
};

const createEmptyUploads = (): Record<AttachmentCategory, UploadedItem[]> => ({
  "Implementation Plan": [],
  "Participants List": [],
  "Press Release": [],
  "Activity Report": [],
  "Bill Voucher": [],
  Photos: []
});

const createEmptyForm = (): FormState => ({
  date: todayIso,
  project: "",
  activityName: "",
  activityOther: "",
  activityCode: "",
  activityType: "",
  venue: "",
  implementedBy: "",
  district: "",
  upazila: "",
  union: "",
  referenceLinks: [""],
  notes: "",
  aiReport: "",
  budget: "",
  expenses: ""
});

const initParticipants = (maps: ProjectActivityMap[], project: string): ParticipantLine[] => {
  const map = maps.find((item) => item.project === project);
  if (!map) return [];
  return map.participantCategories.map((category) => ({
    categoryKey: category.key,
    categoryLabel: category.label,
    male: 0,
    female: 0
  }));
};

const toUploadsFromEntry = (entry: ActivityEntry): Record<AttachmentCategory, UploadedItem[]> => {
  const files = createEmptyUploads();
  entry.attachments.forEach((attachment, index) => {
    files[attachment.category].push({
      id: `existing-${attachment.id}`,
      attachmentId: attachment.id,
      sequence: index + 1,
      name: buildAttachmentFileName(
        entry.uniqueId,
        entry.activityName,
        index + 1,
        attachment.name,
        attachment.type === "image" ? "image/jpeg" : undefined
      ),
      size: Math.max(1, attachment.sizeKb || 0) * 1024,
      mimeType: attachment.type === "image" ? "image/*" : "application/octet-stream",
      kind: attachment.type,
      previewUrl: attachment.type === "image" ? attachment.url : null,
      serverUrl: attachment.url || "#",
      status: "uploaded",
      progress: 100
    });
  });
  return files;
};

const toAttachments = (
  filesByCategory: Record<AttachmentCategory, UploadedItem[]>,
  uniqueId: string,
  activityName: string
): ActivityAttachment[] => {
  const orderedFiles = uploadCategories
    .flatMap((category) => (filesByCategory[category] || []).map((item) => ({ category, item })))
    .filter(({ item }) => item.status === "uploaded" && item.serverUrl)
    .sort((left, right) => left.item.sequence - right.item.sequence);

  const list: ActivityAttachment[] = [];
  orderedFiles.forEach(({ category, item }) => {
    list.push({
      id: item.attachmentId || `file-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      category,
      name: buildAttachmentFileName(uniqueId, activityName, item.sequence, item.name, item.mimeType),
      url: item.serverUrl,
      type: item.kind,
      sizeKb: Math.max(1, Math.round(item.size / 1024))
    });
  });
  return list;
};

const shortFileName = (name: string, max = 10) => (name.length <= max ? name : `${name.slice(0, max)}...`);

const moneyInput = (value: string) => {
  let digits = value.replace(/[^\d]/g, "");
  if (digits.length > 1 && digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
    if (digits === "") return "0";
  }
  return digits;
};

const buildNarrative = (
  form: FormState,
  participants: ParticipantLine[],
  attachmentCount: number,
  budgetValue: number,
  expenseValue: number
) => {
  const male = participants.reduce((sum, item) => sum + item.male, 0);
  const female = participants.reduce((sum, item) => sum + item.female, 0);
  const total = male + female;
  return [
    `On ${form.date}, PRAAN conducted ${form.activityName || "the selected activity"} under ${form.project || "the selected project"} at ${form.venue || "the selected venue"}.`,
    `Implementation was led by ${form.implementedBy || "the assigned implementing team"} in ${form.district || "district"}, ${form.upazila || "upazila"}, ${form.union || "union"}.`,
    `A total of ${total} participants attended, including ${male} male and ${female} female participants across approved project categories.`,
    `The approved budget was ${formatCurrency(budgetValue)} and the expense recorded was ${formatCurrency(expenseValue)}, resulting in a variance of ${calcVariance(budgetValue, expenseValue).toFixed(1)} percent.`,
    `Field teams documented the process, outcomes, and follow-up points to support monitoring, review, and role-based reporting workflows.`,
    `${attachmentCount} supporting file(s) were attached across standard upload categories for audit and export readiness.`
  ].join(" ");
};

const buildId = (entries: ActivityEntry[], dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const prefix = `PR-${yy}${mm}`;
  const serial = String(entries.filter((entry) => entry.uniqueId.startsWith(prefix)).length + 1).padStart(2, "0");
  return `PR-${yy}${mm}${dd}${serial}`;
};

const entryToForm = (entry: ActivityEntry): FormState => ({
  date: entry.date || todayIso,
  project: entry.project || "",
  activityName: entry.activityName || "",
  activityOther: "",
  activityCode: entry.activityCode || "",
  activityType: entry.activityType || "",
  venue: entry.venue || "",
  implementedBy: entry.implementedBy || "",
  district: entry.district || "",
  upazila: entry.upazila || "",
  union: entry.union || "",
  referenceLinks: entry.referenceLink ? entry.referenceLink.split(",").map((s) => s.trim()).filter(Boolean) : [""],
  notes: entry.notes || "",
  aiReport: entry.aiReport || "",
  budget: entry.totalBudget ? String(entry.totalBudget) : "",
  expenses: entry.totalExpenses ? String(entry.totalExpenses) : ""
});

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const loadImageElement = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load selected image."));
    image.src = url;
  });

const optimizeImageForUpload = async (file: File) => {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) {
    return file;
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(sourceUrl);
    const maxDimension = file.size > 6_000_000 ? 1920 : 2400;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    const outputType = file.type === "image/png" || file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const quality = outputType === "image/jpeg" ? (file.size > 7_000_000 ? 0.72 : 0.82) : 0.8;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), outputType, quality);
    });

    if (!blob || blob.size >= file.size * 0.96) {
      return file;
    }

    const nextExtension = getMimeExtension(outputType) || "jpg";
    return new File([blob], replaceFileExtension(file.name, nextExtension), {
      type: outputType,
      lastModified: file.lastModified
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

const uploadFileToServer = (file: File, onProgress: (progress: number) => void) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.max(1, Math.min(progress, 99)));
    };

    xhr.onerror = () => reject(new Error("Upload request failed."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => {
      let payload: UploadApiResponse | null = null;
      if (xhr.response && typeof xhr.response === "object") {
        payload = xhr.response as UploadApiResponse;
      } else if (typeof xhr.responseText === "string" && xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText) as UploadApiResponse;
        } catch {
          payload = null;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload.url) {
        onProgress(100);
        resolve(payload);
        return;
      }

      const message = payload?.message || `Upload failed with status ${xhr.status}`;
      reject(new Error(message));
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });

const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
};

export const NewActivityForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    entries,
    addEntry,
    updateEntry,
    projectMap,
    locationMap,
    venueOptions,
    implementedByOptions,
    setVenueOptions,
    setImplementedByOptions,
    notify
  } = useAppContext();

  const editId = (searchParams.get("edit") || "").trim();
  const editEntry = useMemo(
    () => (editId ? entries.find((entry) => entry.uniqueId === editId) || null : null),
    [editId, entries]
  );
  const isEditMode = Boolean(editId && editEntry);
  const hydratedEditRef = useRef<string>("");
  const missingEditNoticeRef = useRef<string>("");

  const [form, setForm] = useState<FormState>(createEmptyForm());
  const [participants, setParticipants] = useState<ParticipantLine[]>([]);
  const [filesByCategory, setFilesByCategory] = useState<Record<AttachmentCategory, UploadedItem[]>>(
    createEmptyUploads
  );
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [successEntry, setSuccessEntry] = useState<ActivityEntry | null>(null);
  const [open, setOpen] = useState({ info: true, participants: true, financial: true, uploads: true });

  useEffect(() => {
    if (!editId) {
      hydratedEditRef.current = "";
      missingEditNoticeRef.current = "";
      return;
    }

    if (!editEntry) {
      if (missingEditNoticeRef.current !== editId) {
        notify(`Entry not found: ${editId}`, "error");
        missingEditNoticeRef.current = editId;
      }
      return;
    }

    if (hydratedEditRef.current === editId) return;
    hydratedEditRef.current = editId;
    missingEditNoticeRef.current = "";

    setForm(entryToForm(editEntry));
    setParticipants(
      editEntry.participants.length
        ? editEntry.participants.map((line) => ({ ...line }))
        : initParticipants(projectMap, editEntry.project)
    );
    setFilesByCategory(toUploadsFromEntry(editEntry));
    setConfirmed(false);
  }, [editId, editEntry, notify, projectMap]);

  const availableProjects = useMemo(
    () =>
      projectMap.filter((item) => {
        if (!item.locked) return true;
        return isEditMode && item.project === form.project;
      }),
    [projectMap, isEditMode, form.project]
  );

  const selectedProjectMap = projectMap.find((item) => item.project === form.project);
  const selectedDistrictMap = locationMap.find((item) => item.district === form.district);
  const upazilaList = useMemo(
    () => (selectedDistrictMap ? selectedDistrictMap.upazilas.map((item) => item.name) : []),
    [selectedDistrictMap]
  );
  const selectedUpazila = selectedDistrictMap?.upazilas.find((item) => item.name === form.upazila);
  const unionList = useMemo(() => selectedUpazila?.unions ?? [], [selectedUpazila]);
  const budgetValue = Number(form.budget || 0);
  const expenseValue = Number(form.expenses || 0);
  const totalMale = participants.reduce((sum, row) => sum + row.male, 0);
  const totalFemale = participants.reduce((sum, row) => sum + row.female, 0);
  const grandTotal = totalMale + totalFemale;
  const attachmentCount = uploadCategories.reduce((sum, key) => sum + (filesByCategory[key]?.length || 0), 0);
  const variance = calcVariance(budgetValue, expenseValue);
  const utilization = calcUtilization(budgetValue, expenseValue);
  const generatedId = isEditMode && editEntry ? editEntry.uniqueId : buildId(entries, form.date);

  const allUploads = useMemo(() => uploadCategories.flatMap((category) => filesByCategory[category]), [filesByCategory]);
  const uploadPreparing = allUploads.filter((item) => item.status === "preparing").length;
  const uploadInProgress = allUploads.filter((item) => item.status === "uploading").length;
  const uploadFailed = allUploads.filter((item) => item.status === "failed").length;
  const uploadCompleted = allUploads.filter((item) => item.status === "uploaded").length;
  const hasPendingUploads = uploadPreparing + uploadInProgress > 0;
  const hasFailedUploads = uploadFailed > 0;
  const uploadProgress = useMemo(() => {
    if (!allUploads.length) return 0;
    const raw = Math.round(
      allUploads.reduce((sum, item) => sum + (item.status === "preparing" ? 0 : item.progress), 0) / allUploads.length
    );
    if (hasPendingUploads) return Math.max(1, Math.min(99, raw));
    return Math.max(0, raw);
  }, [allUploads, hasPendingUploads]);

  const projectOptions = useMemo<SearchableOption[]>(
    () =>
      projectMap.map((item) => ({
        value: item.project,
        label: item.project,
        disabled: Boolean(item.locked) && (!isEditMode || item.project !== form.project),
        hint: item.locked ? "Locked" : undefined
      })),
    [projectMap, isEditMode, form.project]
  );

  const activityOptions = useMemo<SearchableOption[]>(
    () =>
      (selectedProjectMap?.activities || []).map((item) => ({
        value: item.name,
        label: item.name,
        disabled: Boolean(item.locked) && (!isEditMode || item.name !== form.activityName),
        hint: item.locked ? "Locked" : item.type
      })),
    [selectedProjectMap, isEditMode, form.activityName]
  );

  const districtOptions = useMemo<SearchableOption[]>(
    () => locationMap.map((item) => ({ value: item.district, label: item.district })),
    [locationMap]
  );

  const upazilaOptions = useMemo<SearchableOption[]>(
    () => upazilaList.map((item) => ({ value: item, label: item })),
    [upazilaList]
  );

  const unionOptions = useMemo<SearchableOption[]>(
    () => unionList.map((item) => ({ value: item, label: item })),
    [unionList]
  );

  const venueSearchOptions = useMemo<SearchableOption[]>(
    () => venueOptions.map((item) => ({ value: item, label: item })),
    [venueOptions]
  );

  const implementedBySearchOptions = useMemo<SearchableOption[]>(
    () => implementedByOptions.map((item) => ({ value: item, label: item })),
    [implementedByOptions]
  );

  const addVenueChoice = (value: string) => {
    const item = value.trim();
    if (item && !venueOptions.includes(item)) setVenueOptions([...venueOptions, item]);
  };

  const addImplementedByChoice = (value: string) => {
    const item = value.trim();
    if (item && !implementedByOptions.includes(item)) setImplementedByOptions([...implementedByOptions, item]);
  };

  const setProject = (project: string) => {
    if (!project) {
      setForm((prev) => ({
        ...prev,
        project: "",
        activityName: "",
        activityCode: "",
        activityType: ""
      }));
      setParticipants([]);
      return;
    }

    const map = projectMap.find((item) => item.project === project);

    setForm((prev) => ({
      ...prev,
      project: map?.project || "",
      activityName: "",
      activityCode: "",
      activityType: ""
    }));
    setParticipants(map?.project ? initParticipants(projectMap, map.project) : []);
  };

  const setActivity = (activityName: string) => {
    if (!selectedProjectMap) return;
    const selected =
      selectedProjectMap.activities.find((item) => item.name === activityName && !item.locked) ||
      selectedProjectMap.activities.find((item) => item.name === activityName);
    setForm((prev) => ({
      ...prev,
      activityName: selected?.name || "",
      activityOther: selected?.name === "Other" ? prev.activityOther : "",
      activityCode: selected?.code || "",
      activityType: selected?.type || ""
    }));
  };

  const setDistrict = (district: string) => {
    if (!district) {
      setForm((prev) => ({ ...prev, district: "", upazila: "", union: "" }));
      return;
    }
    const selected = locationMap.find((item) => item.district === district);
    const firstUpazila = selected?.upazilas[0];
    setForm((prev) => ({
      ...prev,
      district,
      upazila: firstUpazila?.name || "",
      union: firstUpazila?.unions[0] || ""
    }));
  };

  const setUpazila = (upazila: string) => {
    if (!selectedDistrictMap || !upazila) {
      setForm((prev) => ({ ...prev, upazila: "", union: "" }));
      return;
    }
    const selected = selectedDistrictMap.upazilas.find((item) => item.name === upazila);
    setForm((prev) => ({
      ...prev,
      upazila: selected?.name || "",
      union: selected?.unions[0] || ""
    }));
  };

  const updateCount = (key: string, field: "male" | "female", value: number) =>
    setParticipants((prev) =>
      prev.map((row) => (row.categoryKey === key ? { ...row, [field]: Math.max(0, value) } : row))
    );

  const updateUploadItem = (
    category: AttachmentCategory,
    uploadId: string,
    updates: Partial<UploadedItem>
  ) => {
    setFilesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].map((item) => (item.id === uploadId ? { ...item, ...updates } : item))
    }));
  };

  const uploadSingleFile = async (category: AttachmentCategory, sourceFile: File, sequence: number) => {
    const uploadId = `up-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const isImage = sourceFile.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(sourceFile) : null;
    const initialName = buildAttachmentFileName(
      generatedId,
      form.activityName || "Activity",
      sequence,
      sourceFile.name,
      sourceFile.type
    );

    const initialItem: UploadedItem = {
      id: uploadId,
      sequence,
      name: initialName,
      size: sourceFile.size,
      mimeType: sourceFile.type || "application/octet-stream",
      kind: isImage ? "image" : "document",
      previewUrl,
      serverUrl: "",
      status: isImage && sourceFile.size >= 1_500_000 ? "preparing" : "uploading",
      progress: 0
    };

    setFilesByCategory((prev) => ({
      ...prev,
      [category]: [...prev[category], initialItem]
    }));

    try {
      const preparedFile = await optimizeImageForUpload(sourceFile);
      const uploadFile =
        preparedFile.name === initialName
          ? preparedFile
          : new File(
              [preparedFile],
              replaceFileExtension(initialName, getMimeExtension(preparedFile.type) || getFileExtension(initialName)),
              {
                type: preparedFile.type || sourceFile.type || "application/octet-stream",
                lastModified: preparedFile.lastModified
              }
            );

      updateUploadItem(category, uploadId, {
        status: "uploading",
        name: uploadFile.name,
        size: uploadFile.size,
        mimeType: uploadFile.type || initialItem.mimeType,
        progress: 0
      });

      const result = await uploadFileToServer(uploadFile, (progress) => {
        updateUploadItem(category, uploadId, { progress });
      });

      updateUploadItem(category, uploadId, {
        status: "uploaded",
        progress: 100,
        name: result.name || uploadFile.name,
        mimeType: result.mimeType || initialItem.mimeType,
        kind: result.type || initialItem.kind,
        serverUrl: result.url,
        size: Math.max(1, (result.sizeKb || Math.round(uploadFile.size / 1024)) * 1024)
      });
    } catch (error) {
      if (isLocalDevHost()) {
        try {
          const dataUrl = await fileToDataUrl(sourceFile);
          updateUploadItem(category, uploadId, {
            status: "uploaded",
            progress: 100,
            serverUrl: dataUrl
          });
          return;
        } catch {
          // fall through to failed state
        }
      }

      updateUploadItem(category, uploadId, {
        status: "failed",
        progress: 0,
        serverUrl: ""
      });
      notify(`Upload failed: ${sourceFile.name}. Please retry.`, "error");
      console.error("Upload failed", error);
    }
  };

  const onFileChange = (category: AttachmentCategory, list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    const startSequence = allUploads.length;
    files.forEach((file, index) => {
      void uploadSingleFile(category, file, startSequence + index + 1);
    });
  };

  const removeFile = (category: AttachmentCategory, index: number) =>
    setFilesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].filter((item, current) => {
        if (current !== index) return true;
        if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
        return false;
      })
    }));

  const buildEntry = (status: EntryStatus): ActivityEntry => {
    const now = new Date().toISOString();
    const existing = isEditMode ? editEntry : null;
    const resolvedActivityName =
      form.activityName === "Other" ? form.activityOther.trim() || "Other" : form.activityName;
    return {
      uniqueId: existing?.uniqueId || buildId(entries, form.date),
      status,
      date: form.date,
      project: form.project,
      activityName: resolvedActivityName,
      activityType: form.activityType,
      activityCode: form.activityCode,
      venue: form.venue,
      district: form.district,
      upazila: form.upazila,
      union: form.union,
      implementedBy: form.implementedBy,
      participants,
      totalMale,
      totalFemale,
      grandTotal,
      totalBudget: budgetValue,
      totalExpenses: expenseValue,
      variance,
      referenceLink: form.referenceLinks.filter((link) => link.trim() !== "").join(", "),
      notes: form.notes,
      aiReport: form.aiReport,
      attachments: toAttachments(filesByCategory, existing?.uniqueId || generatedId, resolvedActivityName),
      createdBy: existing?.createdBy || user?.username || "unknown",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      submittedAt: status === "Draft" ? existing?.submittedAt : existing?.submittedAt || now,
      reviewedBy: existing?.reviewedBy,
      reviewedAt: existing?.reviewedAt
    };
  };

  const reset = () => {
    setForm(createEmptyForm());
    setParticipants([]);
    setFilesByCategory((prev) => {
      uploadCategories.forEach((category) =>
        prev[category].forEach((item) => {
          if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }
        })
      );
      return createEmptyUploads();
    });
    setConfirmed(false);
  };

  const saveOrUpdateEntry = (entry: ActivityEntry) => {
    if (isEditMode && editEntry) {
      updateEntry(editEntry.uniqueId, entry);
      return;
    }
    addEntry(entry);
  };

  const onSaveDraft = () => {
    if (savingDraft) return;
    if (hasPendingUploads) {
      notify("Files are still uploading. Please wait until upload completes.", "info");
      return;
    }
    if (hasFailedUploads) {
      notify("Some uploads failed. Remove failed files or upload again.", "error");
      return;
    }

    setSavingDraft(true);
    const entry = buildEntry("Draft");
    saveOrUpdateEntry(entry);

    setTimeout(() => {
      setSavingDraft(false);
      notify(`Draft saved: ${entry.uniqueId}`, "success");
    }, 400);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!confirmed) {
      notify("Please check the confirmation box before submitting.", "info");
      return;
    }
    if (hasPendingUploads) {
      notify("Files are still uploading. Please wait until upload completes.", "info");
      return;
    }
    if (hasFailedUploads) {
      notify("Some uploads failed. Remove failed files or upload again before submit.", "error");
      return;
    }

    setSubmitting(true);
    const entry = buildEntry("Submitted");
    saveOrUpdateEntry(entry);

    setTimeout(() => {
      setSubmitting(false);
      setSuccessEntry(entry);
      if (!isEditMode) {
        reset();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 900);
  };

  return (
    <>
      {submitting && (
        <div className="blocking-loader">
          <div className="panel-card text-center">
            <div className="spinner-border text-success mb-2" role="status" />
            <p className="mb-0">Submitting activity and uploading files...</p>
          </div>
        </div>
      )}

      {successEntry && (
        <div className="modal-overlay">
          <div className="success-modal success-modal-glitter">
            <button className="icon-btn success-close-btn" onClick={() => setSuccessEntry(null)} aria-label="Close">
              <i className="bi bi-x-lg" />
            </button>
            <div className="success-burst" aria-hidden="true">
              <i className="bi bi-check2-circle" />
            </div>
            <h3 className="mb-2">{isEditMode ? "Activity Updated Successfully" : "Activity Submitted Successfully"}</h3>
            <p className="text-muted mb-3">Unique ID: {successEntry.uniqueId}</p>
            <div className="success-grid">
              <div>
                <small>Project</small>
                <p>{successEntry.project || "-"}</p>
              </div>
              <div>
                <small>Activity</small>
                <p>{successEntry.activityName || "-"}</p>
              </div>
              <div>
                <small>Budget</small>
                <p>{formatCurrency(successEntry.totalBudget)}</p>
              </div>
              <div>
                <small>Male / Female</small>
                <p>
                  {successEntry.totalMale} / {successEntry.totalFemale}
                </p>
              </div>
              <div>
                <small>Total Files</small>
                <p>{successEntry.attachments.length}</p>
              </div>
              <div>
                <small>Total Photos</small>
                <p>{successEntry.attachments.filter((item) => item.category === "Photos").length}</p>
              </div>
            </div>
            <div className="d-grid gap-2">
              <button
                className="primary-btn w-100"
                onClick={() => {
                  setSuccessEntry(null);
                  if (isEditMode) {
                    reset();
                    router.push("/activities/new");
                    return;
                  }
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                New Entry
              </button>
              <button
                className="outline-btn w-100"
                onClick={() => {
                  const entryId = successEntry.uniqueId;
                  setSuccessEntry(null);
                  router.push(`/activities?entry=${encodeURIComponent(entryId)}`);
                }}
              >
                View Entry
              </button>
            </div>
          </div>
        </div>
      )}

      <form className="activity-form-layout" onSubmit={onSubmit}>
        <section>
          <header className="page-heading d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">{isEditMode ? "Edit Activity Entry" : "Activity Entry Form"}</h1>
              <p className="page-subtitle mb-1">
                ID: <strong className="text-success mono">{generatedId}</strong> - Date: {form.date}
              </p>
              {isEditMode && (
                <p className="small text-muted mb-0">
                  You are editing existing data. Save draft or submit to update the same entry.
                </p>
              )}
            </div>
            <div className="d-flex gap-2">
              {isEditMode && (
                <button
                  className="outline-btn"
                  type="button"
                  onClick={() => {
                    reset();
                    router.push("/activities/new");
                  }}
                >
                  <i className="bi bi-arrow-left" /> Exit Edit
                </button>
              )}
              <button className="outline-btn" type="button" onClick={onSaveDraft}>
                <i className="bi bi-cloud-arrow-down" /> {savingDraft ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </header>

          <div className="d-grid gap-3">
            <article className="section-card">
              <button className="section-header" type="button" onClick={() => setOpen((prev) => ({ ...prev, info: !prev.info }))}>
                <span className="section-title-wrap">
                  <span className="section-index">1</span>
                  <i className="bi bi-file-earmark-text" />
                  <span>Activity Info</span>
                </span>
                <i className={clsx("bi", open.info ? "bi-chevron-up" : "bi-chevron-down")} />
              </button>
              {open.info && (
                <div className="section-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Activity Date</label>
                      <input
                        type="date"
                        className="form-control premium-input"
                        value={form.date}
                        onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Activity ID</label>
                      <input className="form-control premium-input" value={generatedId} readOnly />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Project *</label>
                      <SearchableSelect
                        value={form.project}
                        onChange={setProject}
                        options={projectOptions}
                        placeholder="Select project"
                        disabled={!availableProjects.length}
                        emptyMessage="No project found"
                      />
                      {!availableProjects.length && (
                        <small className="text-danger">All projects are currently locked by admin.</small>
                      )}
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Activity *</label>
                      <select
                        className="form-select premium-input"
                        value={form.activityName}
                        onChange={(event) => setActivity(event.target.value)}
                        disabled={!selectedProjectMap}
                      >
                        <option value="">{selectedProjectMap ? "Select activity" : "Select project first"}</option>
                        {activityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {form.activityName === "Other" && (
                        <input
                          className="form-control premium-input mt-2"
                          placeholder="Write other activity name"
                          value={form.activityOther}
                          onChange={(event) => setForm((prev) => ({ ...prev, activityOther: event.target.value }))}
                        />
                      )}
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Activity Code *</label>
                      <input className="form-control premium-input" value={form.activityCode} readOnly />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Venue *</label>
                      <SearchableSelect
                        value={form.venue}
                        onChange={(value) => setForm((prev) => ({ ...prev, venue: value }))}
                        options={venueSearchOptions}
                        placeholder="Search or type venue"
                        allowCustomValue
                        onCommitCustomValue={addVenueChoice}
                        emptyMessage="No saved venue found"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Implemented By *</label>
                      <SearchableSelect
                        value={form.implementedBy}
                        onChange={(value) => setForm((prev) => ({ ...prev, implementedBy: value }))}
                        options={implementedBySearchOptions}
                        placeholder="Search or type implementer"
                        allowCustomValue
                        onCommitCustomValue={addImplementedByChoice}
                        emptyMessage="No saved implementer found"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">District *</label>
                      <SearchableSelect
                        value={form.district}
                        onChange={setDistrict}
                        options={districtOptions}
                        placeholder="Select district"
                        emptyMessage="No district found"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Upazila *</label>
                      <SearchableSelect
                        value={form.upazila}
                        onChange={setUpazila}
                        options={upazilaOptions}
                        placeholder={upazilaList.length ? "Select upazila" : "Select district first"}
                        disabled={!upazilaList.length}
                        emptyMessage="No upazila found"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Union *</label>
                      <SearchableSelect
                        value={form.union}
                        onChange={(value) => setForm((prev) => ({ ...prev, union: value }))}
                        options={unionOptions}
                        placeholder={unionList.length ? "Select union" : "Select upazila first"}
                        disabled={!unionList.length}
                        emptyMessage="No union found"
                      />
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="section-card">
              <button
                className="section-header"
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, participants: !prev.participants }))}
              >
                <span className="section-title-wrap">
                  <span className="section-index">2</span>
                  <i className="bi bi-people" />
                  <span>Participants</span>
                </span>
                <i className={clsx("bi", open.participants ? "bi-chevron-up" : "bi-chevron-down")} />
              </button>
              {open.participants && (
                <div className="section-body">
                  <p className="text-muted mb-3">
                    Enter participant counts by category and gender. Totals are calculated automatically.
                  </p>
                  {!participants.length && (
                    <div className="empty-participant-state">
                      Select a project first to load participant categories for that project.
                    </div>
                  )}
                  {!!participants.length && (
                    <>
                      <div className="table-responsive participant-desktop">
                      <div className="participant-table" style={{ minWidth: "600px" }}>
                        <div className="participant-head">
                          <span>Category</span>
                          <span>Male</span>
                          <span>Female</span>
                          <span>Total</span>
                        </div>
                        {participants.map((row) => (
                          <div key={row.categoryKey} className="participant-row">
                            <div className="participant-label">
                              <span className="dot" /> {row.categoryLabel}
                            </div>
                            <div className="counter-group">
                              <button
                                tabIndex={-1}
                                type="button"
                                className="counter-btn"
                                onClick={() => updateCount(row.categoryKey, "male", row.male - 1)}
                              >
                                -
                              </button>
                              <input
                                className="counter-input"
                                type="number"
                                min={0}
                                value={row.male}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) =>
                                  updateCount(row.categoryKey, "male", Number(event.target.value || 0))
                                }
                              />
                              <button
                                tabIndex={-1}
                                type="button"
                                className="counter-btn"
                                onClick={() => updateCount(row.categoryKey, "male", row.male + 1)}
                              >
                                +
                              </button>
                            </div>
                            <div className="counter-group">
                              <button
                                tabIndex={-1}
                                type="button"
                                className="counter-btn"
                                onClick={() => updateCount(row.categoryKey, "female", row.female - 1)}
                              >
                                -
                              </button>
                              <input
                                className="counter-input"
                                type="number"
                                min={0}
                                value={row.female}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) =>
                                  updateCount(row.categoryKey, "female", Number(event.target.value || 0))
                                }
                              />
                              <button
                                tabIndex={-1}
                                type="button"
                                className="counter-btn"
                                onClick={() => updateCount(row.categoryKey, "female", row.female + 1)}
                              >
                                +
                              </button>
                            </div>
                            <div className="participant-row-total">{row.male + row.female}</div>
                          </div>
                        ))}
                        <div className="participant-total-row">
                          <strong>Total</strong>
                          <strong>{totalMale}</strong>
                          <strong>{totalFemale}</strong>
                          <strong>{grandTotal}</strong>
                        </div>
                      </div>
                      </div>

                      <div className="participant-mobile-list">
                        {participants.map((row) => (
                          <article key={`${row.categoryKey}-mobile`} className="participant-mobile-card">
                            <p className="participant-mobile-title">
                              <span className="dot" /> {row.categoryLabel}
                            </p>
                            <div className="participant-mobile-controls">
                              <div>
                                <p className="participant-mobile-label">Male</p>
                                <div className="counter-group">
                                  <button
                                    tabIndex={-1}
                                    type="button"
                                    className="counter-btn"
                                    onClick={() => updateCount(row.categoryKey, "male", row.male - 1)}
                                  >
                                    -
                                  </button>
                                  <input
                                    className="counter-input"
                                    type="number"
                                    min={0}
                                    value={row.male}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) =>
                                      updateCount(row.categoryKey, "male", Number(event.target.value || 0))
                                    }
                                  />
                                  <button
                                    tabIndex={-1}
                                    type="button"
                                    className="counter-btn"
                                    onClick={() => updateCount(row.categoryKey, "male", row.male + 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div>
                                <p className="participant-mobile-label">Female</p>
                                <div className="counter-group">
                                  <button
                                    tabIndex={-1}
                                    type="button"
                                    className="counter-btn"
                                    onClick={() => updateCount(row.categoryKey, "female", row.female - 1)}
                                  >
                                    -
                                  </button>
                                  <input
                                    className="counter-input"
                                    type="number"
                                    min={0}
                                    value={row.female}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) =>
                                      updateCount(row.categoryKey, "female", Number(event.target.value || 0))
                                    }
                                  />
                                  <button
                                    tabIndex={-1}
                                    type="button"
                                    className="counter-btn"
                                    onClick={() => updateCount(row.categoryKey, "female", row.female + 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                            <p className="participant-mobile-total-line">Total: {row.male + row.female}</p>
                          </article>
                        ))}
                        <div className="participant-mobile-total">
                          <p className="mb-1">Grand Total</p>
                          <strong>{grandTotal}</strong>
                          <p className="mb-0 mt-1 small text-muted">
                            Male: {totalMale} | Female: {totalFemale}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>

            <article className="section-card">
              <button className="section-header" type="button" onClick={() => setOpen((prev) => ({ ...prev, financial: !prev.financial }))}>
                <span className="section-title-wrap">
                  <span className="section-index">3</span>
                  <i className="bi bi-cash-coin" />
                  <span>Financial</span>
                </span>
                <i className={clsx("bi", open.financial ? "bi-chevron-up" : "bi-chevron-down")} />
              </button>
              {open.financial && (
                <div className="section-body">
                  <p className="text-muted mb-3">Enter financial details in BDT. Variance is calculated automatically.</p>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Approved Budget (BDT) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control premium-input"
                        placeholder="Enter amount"
                        value={form.budget || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, budget: moneyInput(event.target.value) }))}
                      />
                      <small className="text-muted">{formatCurrency(budgetValue)}</small>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Actual Expenses (BDT) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control premium-input"
                        placeholder="Enter amount"
                        value={form.expenses || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, expenses: moneyInput(event.target.value) }))}
                      />
                      <small className="text-muted">{formatCurrency(expenseValue)}</small>
                    </div>
                  </div>
                  <div className="financial-cards mt-3">
                    <article className="financial-card">
                      <p className="metric-label">Remaining</p>
                      <p className={clsx("metric-value", expenseValue > budgetValue && "text-danger")}>
                        {formatCurrency(budgetValue - expenseValue)}
                      </p>
                      {expenseValue > budgetValue && <small className="text-danger">Over budget</small>}
                    </article>
                    <article className="financial-card">
                      <p className="metric-label">Utilization</p>
                      <p className="metric-value">{utilization.toFixed(1)}%</p>
                      <div className="progress premium-progress">
                        <div
                          className={clsx("progress-bar", utilization > 100 ? "bg-danger" : "bg-success")}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </article>
                    <article className="financial-card">
                      <p className="metric-label">Variance</p>
                      <p className={clsx("metric-value", variance < 0 ? "text-danger" : "text-success")}>
                        {variance.toFixed(1)}%
                      </p>
                    </article>
                  </div>
                </div>
              )}
            </article>

            <article className="section-card">
              <button className="section-header" type="button" onClick={() => setOpen((prev) => ({ ...prev, uploads: !prev.uploads }))}>
                <span className="section-title-wrap">
                  <span className="section-index">4</span>
                  <i className="bi bi-paperclip" />
                  <span>Uploads & Notes</span>
                </span>
                <i className={clsx("bi", open.uploads ? "bi-chevron-up" : "bi-chevron-down")} />
              </button>
              {open.uploads && (
                <div className="section-body">
                  <div className="upload-grid">
                    {docUploadCategories.map((category) => (
                      <article className="upload-card" key={category}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <p className="mb-0 fw-semibold">{category}</p>
                          <span className="badge-count">{filesByCategory[category].length}</span>
                        </div>
                        <label className="upload-zone">
                          <i className="bi bi-upload" /> Upload
                          <input type="file" multiple className="d-none" onChange={(event) => onFileChange(category, event.target.files)} />
                        </label>
                        <div className="d-grid gap-2 mt-2">
                          {filesByCategory[category].map((item, index) => (
                            <div className={clsx("file-chip", item.previewUrl && "file-chip-image")} key={item.id}>
                              <div className="file-chip-main min-w-0">
                                <span className={clsx("file-mini-thumb", item.previewUrl && "file-mini-thumb-large-doc")}>
                                  {item.previewUrl ? (
                                    <Image src={item.previewUrl} alt={item.name} fill className="object-contain" />
                                  ) : (
                                    <i className={`bi ${getFileIconClass(item.name)} file-type-icon file-type-icon-large`} />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <span className="file-name-short" title={item.name}>
                                    {shortFileName(item.name, 10)}
                                  </span>
                                  {item.status === "preparing" && (
                                    <small className="text-muted d-block mt-1">Optimizing image before upload...</small>
                                  )}
                                  {item.status === "uploading" && (
                                    <div className="progress premium-progress mt-1">
                                      <div className="progress-bar bg-info" style={{ width: `${item.progress}%` }} />
                                    </div>
                                  )}
                                  {item.status === "failed" && (
                                    <small className="text-danger d-block mt-1">Upload failed</small>
                                  )}
                                </div>
                              </div>
                              <button type="button" className="chip-close" onClick={() => removeFile(category, index)} aria-label="Remove file">
                                <i className="bi bi-x" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  {!!allUploads.length && (
                    <article className="panel-card mt-3 p-3">
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <p className="mb-0 fw-semibold">Server Upload Progress</p>
                        <strong>{uploadProgress}%</strong>
                      </div>
                      <div className="progress premium-progress mt-2">
                        <div
                          className={clsx(
                            "progress-bar",
                            hasFailedUploads ? "bg-danger" : hasPendingUploads ? "bg-info" : "bg-success"
                          )}
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="small text-muted mb-0 mt-2">
                        Uploaded {uploadCompleted}/{allUploads.length} file(s)
                        {uploadPreparing ? ` | Preparing ${uploadPreparing}` : ""}
                        {uploadInProgress ? ` | Uploading ${uploadInProgress}` : ""}
                        {uploadFailed ? ` | Failed ${uploadFailed}` : ""}
                      </p>
                    </article>
                  )}
                  <div className="row g-3 mt-2">
                    <div className="col-12 mb-3">
                      <article
                        className="upload-card photo-upload-card"
                        style={{ padding: "1.5rem", border: "2px dashed color-mix(in srgb, var(--brand) 40%, var(--line))" }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <p className="mb-0 fw-semibold fs-5">Photos</p>
                          <span className="badge-count" style={{ fontSize: "1rem", padding: "0.25rem 0.6rem" }}>
                            {filesByCategory.Photos.length}
                          </span>
                        </div>
                        <label className="upload-zone mb-3" style={{ padding: "2rem" }}>
                          <span className="d-flex flex-column align-items-center gap-2">
                            <i className="bi bi-image fs-4" />
                            <span className="fs-5 fw-semibold">Upload Photos</span>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="d-none"
                            onChange={(event) => onFileChange("Photos", event.target.files)}
                          />
                        </label>
                        <div className="photo-preview-grid">
                          {filesByCategory.Photos.map((item, index) => (
                            <div className="photo-preview-item" key={item.id}>
                              <div className="photo-preview-media">
                                {item.previewUrl ? (
                                  <Image src={item.previewUrl} alt={item.name} fill className="object-contain" />
                                ) : (
                                  <span className="photo-fallback">
                                    <i className="bi bi-image" />
                                  </span>
                                )}
                              </div>
                              {item.status === "uploading" && (
                                <div className="progress premium-progress">
                                  <div className="progress-bar bg-info" style={{ width: `${item.progress}%` }} />
                                </div>
                              )}
                              {item.status === "preparing" && (
                                <small className="text-muted d-block mb-1">Optimizing image before upload...</small>
                              )}
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <span className="file-name-short" title={item.name}>
                                  {shortFileName(item.name, 10)}
                                </span>
                                <button type="button" className="chip-close" onClick={() => removeFile("Photos", index)} aria-label="Remove photo">
                                  <i className="bi bi-x" />
                                </button>
                              </div>
                              {item.status === "failed" && <small className="text-danger">Upload failed</small>}
                            </div>
                          ))}
                        </div>
                      </article>
                    </div>

                    <div className="col-12 border-top pt-3">
                      <label className="form-label">Reference Link(s)</label>
                      <div className="d-grid gap-2">
                        {form.referenceLinks.map((link, idx) => (
                          <div key={idx} className="d-flex gap-2">
                            <input
                              className="form-control premium-input"
                              placeholder="https://"
                              value={link}
                              onChange={(event) => {
                                const newLinks = [...form.referenceLinks];
                                newLinks[idx] = event.target.value;
                                setForm((prev) => ({ ...prev, referenceLinks: newLinks }));
                              }}
                            />
                            {form.referenceLinks.length > 1 && (
                              <button
                                type="button"
                                className="icon-btn danger-outline flex-shrink-0"
                                onClick={() => {
                                  const newLinks = form.referenceLinks.filter((_, i) => i !== idx);
                                  setForm((prev) => ({ ...prev, referenceLinks: newLinks }));
                                }}
                                aria-label="Remove link"
                              >
                                <i className="bi bi-x-lg" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn text-primary fw-semibold w-fit d-flex align-items-center gap-1 p-0"
                          style={{ background: "transparent", border: "none" }}
                          onClick={() => setForm((prev) => ({ ...prev, referenceLinks: [...prev.referenceLinks, ""] }))}
                        >
                          <i className="bi bi-plus-circle" /> Add another link
                        </button>
                      </div>
                    </div>
                    
                    <div className="col-12 mt-4">
                      <label className="form-label">Activity Notes / Observations</label>
                      <textarea
                        className="form-control premium-input"
                        rows={6}
                        value={form.notes}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                        onInput={(event) => {
                          const target = event.currentTarget;
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    </div>
                    <div className="col-12">
                      <article className="ai-card">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                          <div>
                            <h3 className="h6 mb-1">AI Narrative Report</h3>
                            <p className="text-muted mb-0">Auto-generate based on form data</p>
                          </div>
                          <button
                            className="primary-btn"
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                aiReport: buildNarrative(prev, participants, attachmentCount, budgetValue, expenseValue)
                              }))
                            }
                          >
                            <i className="bi bi-stars" /> Generate
                          </button>
                        </div>
                        <textarea
                          className="form-control premium-input"
                          rows={6}
                          value={form.aiReport}
                          onChange={(event) => setForm((prev) => ({ ...prev, aiReport: event.target.value }))}
                          onInput={(event) => {
                            const target = event.currentTarget;
                            target.style.height = "auto";
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                        />
                        <button
                          className="text-btn mt-2"
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, notes: prev.aiReport }))}
                        >
                          <i className="bi bi-arrow-down-circle" /> Use as notes
                        </button>
                      </article>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="section-card">
              <div className="section-body">
                <label className="confirm-box">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span>I confirm that all the information provided above is accurate and complete.</span>
                </label>
                <button
                  className="primary-btn submit-btn w-100 mt-3"
                  type="submit"
                  disabled={submitting}
                >
                  <i className="bi bi-send-fill" /> {isEditMode ? "Update Activity" : "Submit Activity"}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="live-summary live-summary-below">
          <div className="panel-card sticky-panel">
            <h2 className="summary-title">
              <i className="bi bi-journal-text" /> Live Summary
            </h2>
            <div className="summary-block">
              <p className="summary-label">Participants</p>
              <p className="summary-total">{grandTotal}</p>
              <div className="gender-grid">
                <div className="gender-pill male">
                  <strong>{totalMale}</strong>
                  <span>Male</span>
                </div>
                <div className="gender-pill female">
                  <strong>{totalFemale}</strong>
                  <span>Female</span>
                </div>
              </div>
            </div>
            <div className="summary-block">
              <p className="summary-label">Financial</p>
              <div className="summary-row">
                <span>Budget</span>
                <strong>{formatCurrency(budgetValue)}</strong>
              </div>
              <div className="summary-row">
                <span>Expenses</span>
                <strong className={clsx(expenseValue > budgetValue && "text-danger")}>{formatCurrency(expenseValue)}</strong>
              </div>
              <div className="summary-row border-top pt-2 mt-2">
                <span>Variance</span>
                <strong className={clsx(variance < 0 ? "text-danger" : "text-success")}>{variance.toFixed(1)}%</strong>
              </div>
              <div className="progress premium-progress mt-2">
                <div
                  className={clsx("progress-bar", utilization > 100 ? "bg-danger" : "bg-success")}
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
            </div>
            <div className="summary-block">
              <div className="summary-row">
                <span>
                  <i className="bi bi-paperclip" /> Attachments
                </span>
                <strong>{attachmentCount}</strong>
              </div>
              {(hasPendingUploads || hasFailedUploads) && (
                <p className={clsx("small mb-0 mt-1", hasFailedUploads ? "text-danger" : "text-muted")}>
                  {hasFailedUploads
                    ? "Some files failed to upload."
                    : `Uploading ${uploadInProgress} file(s)...`}
                </p>
              )}
            </div>
            <p className="summary-note">
              <i className="bi bi-info-circle" /> Complete all sections and confirm before submitting.
            </p>
          </div>
        </section>
      </form>
    </>
  );
};
