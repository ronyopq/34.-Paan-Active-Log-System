"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
const AUTO_DRAFT_KEY = "praan_new_activity_autosave_v1";

type FormState = {
  date: string;
  project: string;
  activityName: string;
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
  directUrl?: string;
  status: "preparing" | "uploading" | "uploaded" | "failed";
  progress: number;
};

type NewActivityAutoDraft = {
  form: FormState;
  participants: ParticipantLine[];
  filesByCategory: Record<AttachmentCategory, UploadedItem[]>;
  confirmed: boolean;
  open: { info: boolean; participants: boolean; financial: boolean; uploads: boolean };
  activeStep?: FormStep;
  savedAt: string;
};

type FormStep = "info" | "participants" | "financial" | "uploads" | "review";

const wizardSteps: Array<{ key: FormStep; title: string; icon: string }> = [
  { key: "info", title: "Activity Info", icon: "bi-file-earmark-text" },
  { key: "participants", title: "Participants", icon: "bi-people" },
  { key: "financial", title: "Financial", icon: "bi-cash-coin" },
  { key: "uploads", title: "Uploads", icon: "bi-paperclip" },
  { key: "review", title: "Review", icon: "bi-check2-circle" }
];

type UploadApiResponse = {
  ok: boolean;
  url: string;
  name: string;
  mimeType: string;
  type: "image" | "document";
  sizeKb: number;
  directUrl?: string;
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

const hasFormContent = (form: FormState, participants: ParticipantLine[], files: Record<AttachmentCategory, UploadedItem[]>) => {
  const emptyForm = createEmptyForm();
  const hasText = Object.keys(emptyForm).some((key) => {
    const field = key as keyof FormState;
    const value = form[field];
    const fallback = emptyForm[field];
    if (Array.isArray(value)) {
      return value.some((item) => item.trim()) || value.length !== (fallback as string[]).length;
    }
    return String(value || "").trim() !== String(fallback || "").trim();
  });
  const hasParticipants = participants.some((line) => line.male > 0 || line.female > 0);
  const hasFiles = uploadCategories.some((category) => files[category]?.some((item) => item.status === "uploaded"));

  return hasText || hasParticipants || hasFiles;
};

const getRestorableUploads = (files: Record<AttachmentCategory, UploadedItem[]>) => {
  const next = createEmptyUploads();

  uploadCategories.forEach((category) => {
    next[category] = (files[category] || [])
      .filter((item) => item.status === "uploaded" && item.serverUrl)
      .map((item) => ({
        ...item,
        previewUrl: item.kind === "image" && item.serverUrl ? item.serverUrl : null,
        status: "uploaded",
        progress: 100
      }));
  });

  return next;
};

const saveAutoDraftToStorage = (draft: NewActivityAutoDraft) => {
  try {
    window.localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Auto draft save failed", error);
  }
};

const createEmptyForm = (): FormState => ({
  date: todayIso,
  project: "",
  activityName: "",
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
      directUrl: attachment.directUrl,
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
      directUrl: item.directUrl,
      type: item.kind,
      sizeKb: Math.max(1, Math.round(item.size / 1024))
    });
  });
  return list;
};

const shortFileName = (name: string, max = 10) => (name.length <= max ? name : `${name.slice(0, max)}...`);
const docAcceptTypes = ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/jpeg,image/png,image/webp";

const uploadCategoryIcons: Record<AttachmentCategory, string> = {
  "Implementation Plan": "bi-diagram-3",
  "Participants List": "bi-people",
  "Press Release": "bi-megaphone",
  "Activity Report": "bi-file-earmark-text",
  "Bill Voucher": "bi-receipt",
  Photos: "bi-images"
};

const getUploadStatusText = (item: UploadedItem) => {
  if (item.status === "preparing") return "Optimizing";
  if (item.status === "uploading") return `${item.progress}%`;
  if (item.status === "failed") return "Failed";
  return "Uploaded";
};

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

const resizeTextarea = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
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
  const venueTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const implementedByTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const aiReportTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoDraftHydratedRef = useRef(false);

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
  const [activeStep, setActiveStep] = useState<FormStep>("info");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>("");
  const [restoredDraftNotice, setRestoredDraftNotice] = useState(false);

  const activeStepIndex = wizardSteps.findIndex((step) => step.key === activeStep);
  const isReviewStep = activeStep === "review";
  const isFirstStep = activeStepIndex <= 0;

  const clearAutoDraft = () => {
    window.localStorage.removeItem(AUTO_DRAFT_KEY);
    setLastAutoSavedAt("");
    setRestoredDraftNotice(false);
  };

  useEffect(() => {
    document.body.classList.add("form-wizard-active");
    return () => document.body.classList.remove("form-wizard-active");
  }, []);

  useEffect(() => {
    resizeTextarea(venueTextareaRef.current);
  }, [form.venue]);

  useEffect(() => {
    resizeTextarea(implementedByTextareaRef.current);
  }, [form.implementedBy]);

  useEffect(() => {
    resizeTextarea(notesTextareaRef.current);
  }, [form.notes]);

  useEffect(() => {
    resizeTextarea(aiReportTextareaRef.current);
  }, [form.aiReport]);

  useEffect(() => {
    if (autoDraftHydratedRef.current) return;

    if (editId) {
      autoDraftHydratedRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(AUTO_DRAFT_KEY);
      if (!raw) {
        autoDraftHydratedRef.current = true;
        return;
      }

      const draft = JSON.parse(raw) as Partial<NewActivityAutoDraft>;
      if (!draft.form || !draft.filesByCategory) {
        window.localStorage.removeItem(AUTO_DRAFT_KEY);
        autoDraftHydratedRef.current = true;
        return;
      }

      setForm({ ...createEmptyForm(), ...draft.form });
      setParticipants(Array.isArray(draft.participants) ? draft.participants.map((line) => ({ ...line })) : []);
      setFilesByCategory(getRestorableUploads(draft.filesByCategory));
      setConfirmed(Boolean(draft.confirmed));
      if (draft.open) setOpen(draft.open);
      if (draft.activeStep && wizardSteps.some((step) => step.key === draft.activeStep)) {
        setActiveStep(draft.activeStep);
      }
      setLastAutoSavedAt(draft.savedAt || "");
      setRestoredDraftNotice(true);
    } catch {
      window.localStorage.removeItem(AUTO_DRAFT_KEY);
    } finally {
      autoDraftHydratedRef.current = true;
    }
  }, [editId, notify]);

  useEffect(() => {
    if (isEditMode || !autoDraftHydratedRef.current) return;

    const timer = window.setTimeout(() => {
      if (!hasFormContent(form, participants, filesByCategory)) {
        window.localStorage.removeItem(AUTO_DRAFT_KEY);
        return;
      }

      const draft: NewActivityAutoDraft = {
        form,
        participants,
        filesByCategory: getRestorableUploads(filesByCategory),
        confirmed,
        open,
        activeStep,
        savedAt: new Date().toISOString()
      };
      saveAutoDraftToStorage(draft);
      setLastAutoSavedAt(draft.savedAt);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [activeStep, confirmed, filesByCategory, form, isEditMode, open, participants]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isEditMode || !hasFormContent(form, participants, filesByCategory)) return;

      const draft: NewActivityAutoDraft = {
        form,
        participants,
        filesByCategory: getRestorableUploads(filesByCategory),
        confirmed,
        open,
        activeStep,
        savedAt: new Date().toISOString()
      };
      saveAutoDraftToStorage(draft);
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeStep, confirmed, filesByCategory, form, isEditMode, open, participants]);

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

  const projectOptions = useMemo(
    () =>
      projectMap.map((item) => ({
        value: item.project,
        label: item.project,
        disabled: Boolean(item.locked) && (!isEditMode || item.project !== form.project),
        hint: item.locked ? "Locked" : undefined
      })),
    [projectMap, isEditMode, form.project]
  );

  const activityOptions = useMemo(
    () =>
      (selectedProjectMap?.activities || []).map((item) => ({
        value: item.name,
        label: item.name,
        disabled: Boolean(item.locked) && (!isEditMode || item.name !== form.activityName),
        hint: item.locked ? "Locked" : item.type
      })),
    [selectedProjectMap, isEditMode, form.activityName]
  );

  const districtOptions = useMemo(
    () => locationMap.map((item) => ({ value: item.district, label: item.district })),
    [locationMap]
  );

  const upazilaOptions = useMemo(
    () => upazilaList.map((item) => ({ value: item, label: item })),
    [upazilaList]
  );

  const unionOptions = useMemo(
    () => unionList.map((item) => ({ value: item, label: item })),
    [unionList]
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
        directUrl: result.directUrl,
        size: Math.max(1, (result.sizeKb || Math.round(uploadFile.size / 1024)) * 1024)
      });
    } catch (error) {
      if (isLocalDevHost()) {
        try {
          const dataUrl = await fileToDataUrl(sourceFile);
          updateUploadItem(category, uploadId, {
            status: "uploaded",
            progress: 100,
            serverUrl: dataUrl,
            directUrl: dataUrl
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
    return {
      uniqueId: existing?.uniqueId || buildId(entries, form.date),
      status,
      date: form.date,
      project: form.project,
      activityName: form.activityName,
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
      attachments: toAttachments(filesByCategory, existing?.uniqueId || generatedId, form.activityName),
      createdBy: existing?.createdBy || user?.username || "unknown",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      submittedAt: status === "Draft" ? existing?.submittedAt : existing?.submittedAt || now,
      reviewedBy: existing?.reviewedBy,
      reviewedAt: existing?.reviewedAt
    };
  };

  const getStepIssues = (step: FormStep) => {
    const issues: string[] = [];

    if (step === "info") {
      if (!form.date) issues.push("Activity date is required.");
      if (!form.project) issues.push("Project is required.");
      if (!form.activityName) issues.push("Activity is required.");
      if (!form.venue.trim()) issues.push("Venue is required.");
      if (!form.implementedBy.trim()) issues.push("Implemented By is required.");
      if (!form.district) issues.push("District is required.");
      if (!form.upazila) issues.push("Upazila is required.");
      if (!form.union) issues.push("Union is required.");
    }

    if (step === "participants") {
      if (!participants.length) issues.push("Select a project to load participant categories.");
      if (participants.length && grandTotal <= 0) issues.push("Enter at least one participant.");
    }

    if (step === "financial") {
      if (budgetValue <= 0) issues.push("Approved budget must be greater than zero.");
      if (!form.expenses) issues.push("Actual expenses are required.");
    }

    if (step === "uploads") {
      if (hasPendingUploads) issues.push("Wait until file uploads are complete.");
      if (hasFailedUploads) issues.push("Remove failed uploads before continuing.");
    }

    if (step === "review") {
      wizardSteps
        .filter((item) => item.key !== "review")
        .forEach((item) => issues.push(...getStepIssues(item.key)));
      if (!confirmed) issues.push("Confirm that all information is accurate.");
    }

    return issues;
  };

  const goToStep = (step: FormStep) => {
    setActiveStep(step);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  const goNext = () => {
    const issues = getStepIssues(activeStep);
    if (issues.length) {
      notify(issues[0], "error");
      return;
    }

    const nextStep = wizardSteps[Math.min(activeStepIndex + 1, wizardSteps.length - 1)]?.key;
    if (nextStep) goToStep(nextStep);
  };

  const goBack = () => {
    if (isFirstStep) {
      router.push("/activities");
      return;
    }
    const prevStep = wizardSteps[Math.max(activeStepIndex - 1, 0)]?.key;
    if (prevStep) goToStep(prevStep);
  };

  const reset = () => {
    if (!isEditMode) clearAutoDraft();
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
    setActiveStep("info");
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
    if (!isEditMode) clearAutoDraft();

    setTimeout(() => {
      setSavingDraft(false);
      notify(`Draft saved: ${entry.uniqueId}`, "success");
    }, 400);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!isReviewStep) {
      goNext();
      return;
    }
    const reviewIssues = getStepIssues("review");
    if (reviewIssues.length) {
      notify(reviewIssues[0], "error");
      return;
    }
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
    if (!isEditMode) clearAutoDraft();

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

          {restoredDraftNotice && (
            <section className="draft-restore-card">
              <div>
                <p className="mb-1 fw-semibold">Saved draft restored</p>
                <small className="text-muted">
                  Continue from your autosaved work or discard it to start fresh.
                </small>
              </div>
              <div className="draft-restore-actions">
                <button className="outline-btn" type="button" onClick={() => setRestoredDraftNotice(false)}>
                  Continue
                </button>
                <button className="danger-outline" type="button" onClick={reset}>
                  Discard
                </button>
              </div>
            </section>
          )}

          <nav className="wizard-stepper" aria-label="Activity form steps">
            {wizardSteps.map((step, index) => {
              const stepIssues = getStepIssues(step.key);
              const isActive = activeStep === step.key;
              const isComplete = !stepIssues.length && index < activeStepIndex;
              return (
                <button
                  key={step.key}
                  className={clsx("wizard-step", isActive && "active", isComplete && "complete", stepIssues.length && "has-issues")}
                  type="button"
                  onClick={() => goToStep(step.key)}
                >
                  <span className="wizard-step-index">
                    <i className={clsx("bi", isComplete ? "bi-check2" : step.icon)} />
                  </span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="draft-status-line">
            <span>
              Step {activeStepIndex + 1} of {wizardSteps.length}: <strong>{wizardSteps[activeStepIndex]?.title}</strong>
            </span>
            {!isEditMode && lastAutoSavedAt && (
              <span className="draft-status-pill">
                <i className="bi bi-cloud-check" /> Autosaved {new Date(lastAutoSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="d-grid gap-3">
            <article className={clsx("section-card wizard-section", activeStep !== "info" && "wizard-section-hidden")}>
              <button className="section-header" type="button" onClick={() => goToStep("info")}>
                <span className="section-title-wrap">
                  <span className="section-index">1</span>
                  <i className="bi bi-file-earmark-text" />
                  <span>Activity Info</span>
                </span>
                <i className="bi bi-chevron-right" />
              </button>
              {activeStep === "info" && (
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
                      <select
                        className="form-select premium-input"
                        value={form.project}
                        onChange={(event) => setProject(event.target.value)}
                        disabled={!availableProjects.length}
                      >
                        <option value="">Select project</option>
                        {projectOptions.map((option) => (
                          <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}{option.hint ? ` (${option.hint})` : ""}
                          </option>
                        ))}
                      </select>
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
                          <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}{option.hint ? ` (${option.hint})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Activity Code *</label>
                      <input className="form-control premium-input" value={form.activityCode} readOnly />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Venue *</label>
                      <textarea
                        ref={venueTextareaRef}
                        className="form-control premium-input auto-grow-textarea compact-auto-grow-textarea"
                        rows={2}
                        value={form.venue}
                        onChange={(event) => {
                          resizeTextarea(event.currentTarget);
                          setForm((prev) => ({ ...prev, venue: event.target.value }));
                        }}
                        onBlur={() => addVenueChoice(form.venue)}
                        placeholder="Type venue"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Implemented By *</label>
                      <textarea
                        ref={implementedByTextareaRef}
                        className="form-control premium-input auto-grow-textarea compact-auto-grow-textarea"
                        rows={2}
                        value={form.implementedBy}
                        onChange={(event) => {
                          resizeTextarea(event.currentTarget);
                          setForm((prev) => ({ ...prev, implementedBy: event.target.value }));
                        }}
                        onBlur={() => addImplementedByChoice(form.implementedBy)}
                        placeholder="Type implementer"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">District *</label>
                      <select
                        className="form-select premium-input"
                        value={form.district}
                        onChange={(event) => setDistrict(event.target.value)}
                      >
                        <option value="">Select district</option>
                        {districtOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Upazila *</label>
                      <select
                        className="form-select premium-input"
                        value={form.upazila}
                        onChange={(event) => setUpazila(event.target.value)}
                        disabled={!upazilaList.length}
                      >
                        <option value="">{upazilaList.length ? "Select upazila" : "Select district first"}</option>
                        {upazilaOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Union *</label>
                      <select
                        className="form-select premium-input"
                        value={form.union}
                        onChange={(event) => setForm((prev) => ({ ...prev, union: event.target.value }))}
                        disabled={!unionList.length}
                      >
                        <option value="">{unionList.length ? "Select union" : "Select upazila first"}</option>
                        {unionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className={clsx("section-card wizard-section", activeStep !== "participants" && "wizard-section-hidden")}>
              <button
                className="section-header"
                type="button"
                onClick={() => goToStep("participants")}
              >
                <span className="section-title-wrap">
                  <span className="section-index">2</span>
                  <i className="bi bi-people" />
                  <span>Participants</span>
                </span>
                <i className="bi bi-chevron-right" />
              </button>
              {activeStep === "participants" && (
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

            <article className={clsx("section-card wizard-section", activeStep !== "financial" && "wizard-section-hidden")}>
              <button className="section-header" type="button" onClick={() => goToStep("financial")}>
                <span className="section-title-wrap">
                  <span className="section-index">3</span>
                  <i className="bi bi-cash-coin" />
                  <span>Financial</span>
                </span>
                <i className="bi bi-chevron-right" />
              </button>
              {activeStep === "financial" && (
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

            <article className={clsx("section-card wizard-section", activeStep !== "uploads" && "wizard-section-hidden")}>
              <button className="section-header" type="button" onClick={() => goToStep("uploads")}>
                <span className="section-title-wrap">
                  <span className="section-index">4</span>
                  <i className="bi bi-paperclip" />
                  <span>Uploads & Notes</span>
                </span>
                <i className="bi bi-chevron-right" />
              </button>
              {activeStep === "uploads" && (
                <div className="section-body">
                  <div className="upload-helper-card">
                    <div>
                      <p className="mb-1 fw-semibold">Attach supporting documents and photos</p>
                      <small className="text-muted">Tap a card to upload from mobile camera, gallery, or files. Max 10 MB per file.</small>
                    </div>
                    {!!allUploads.length && <span className="upload-total-pill">{uploadCompleted}/{allUploads.length} uploaded</span>}
                  </div>

                  <div className="upload-grid">
                    {docUploadCategories.map((category) => (
                      <article className="upload-card modern-upload-card" key={category}>
                        <div className="upload-card-head">
                          <span className="upload-card-icon">
                            <i className={`bi ${uploadCategoryIcons[category]}`} />
                          </span>
                          <div className="min-w-0">
                            <p className="mb-0 fw-semibold text-truncate">{category}</p>
                            <small className="text-muted">PDF, Word, Excel, CSV or image</small>
                          </div>
                          <span className="badge-count">{filesByCategory[category].length}</span>
                        </div>
                        <label className="upload-zone modern-upload-zone">
                          <span className="upload-zone-icon"><i className="bi bi-cloud-arrow-up" /></span>
                          <span>
                            <strong>Tap to upload</strong>
                            <small>Choose one or multiple files</small>
                          </span>
                          <input
                            type="file"
                            multiple
                            accept={docAcceptTypes}
                            className="d-none"
                            onChange={(event) => {
                              onFileChange(category, event.target.files);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <div className="upload-file-list">
                          {filesByCategory[category].map((item, index) => (
                            <div className={clsx("file-chip modern-file-chip", item.previewUrl && "file-chip-image")} key={item.id}>
                              <div className="file-chip-main min-w-0">
                                <span className={clsx("file-mini-thumb modern-file-thumb", item.previewUrl && "modern-file-thumb-image")}>
                                  {item.previewUrl ? (
                                    <Image src={item.previewUrl} alt={item.name} fill className="object-contain" />
                                  ) : (
                                    <i className={`bi ${getFileIconClass(item.name)} file-type-icon file-type-icon-large`} />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <span className="file-name-short" title={item.name}>
                                    {shortFileName(item.name, 26)}
                                  </span>
                                  <span className={clsx("upload-status-pill", `upload-status-${item.status}`)}>
                                    {getUploadStatusText(item)}
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
                    <article className="panel-card upload-progress-card mt-3 p-3">
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
                      <article className="upload-card photo-upload-card modern-photo-card">
                        <div className="photo-upload-head">
                          <div>
                            <p className="mb-1 fw-semibold fs-5">Photos</p>
                            <small className="text-muted">Add activity photos from camera or gallery</small>
                          </div>
                          <span className="badge-count badge-count-large">{filesByCategory.Photos.length}</span>
                        </div>
                        <label className="upload-zone photo-upload-zone mb-3">
                          <span className="photo-upload-icon"><i className="bi bi-camera" /></span>
                          <span className="photo-upload-copy">
                            <strong>Tap to add photos</strong>
                            <small>Camera or gallery, multiple images supported</small>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="d-none"
                            onChange={(event) => {
                              onFileChange("Photos", event.target.files);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <div className="photo-preview-grid">
                          {filesByCategory.Photos.map((item, index) => (
                            <div className="photo-preview-item modern-photo-preview-item" key={item.id}>
                              <div className="photo-preview-media">
                                {item.previewUrl ? (
                                  <Image src={item.previewUrl} alt={item.name} fill className="object-contain" />
                                ) : (
                                  <span className="photo-fallback">
                                    <i className="bi bi-image" />
                                  </span>
                                )}
                                <span className={clsx("photo-status-pill", `upload-status-${item.status}`)}>
                                  {getUploadStatusText(item)}
                                </span>
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
                                  {shortFileName(item.name, 22)}
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
                        ref={notesTextareaRef}
                        className="form-control premium-input auto-grow-textarea activity-notes-textarea"
                        rows={7}
                        value={form.notes}
                        onChange={(event) => {
                          resizeTextarea(event.currentTarget);
                          setForm((prev) => ({ ...prev, notes: event.target.value }));
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
                          ref={aiReportTextareaRef}
                          className="form-control premium-input auto-grow-textarea ai-report-textarea"
                          rows={7}
                          value={form.aiReport}
                          onChange={(event) => {
                            resizeTextarea(event.currentTarget);
                            setForm((prev) => ({ ...prev, aiReport: event.target.value }));
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

            <article className={clsx("section-card wizard-section", activeStep !== "review" && "wizard-section-hidden")}>
              <button className="section-header" type="button" onClick={() => goToStep("review")}>
                <span className="section-title-wrap">
                  <span className="section-index">5</span>
                  <i className="bi bi-check2-circle" />
                  <span>Review & Submit</span>
                </span>
                <i className="bi bi-chevron-right" />
              </button>
              {activeStep === "review" && (
                <div className="section-body">
                  <div className="review-grid">
                    <article className="review-card">
                      <p className="review-label">Activity</p>
                      <h3>{form.activityName || "Not selected"}</h3>
                      <p className="mb-0 text-muted">{form.project || "No project"}</p>
                    </article>
                    <article className="review-card">
                      <p className="review-label">Location</p>
                      <h3>{form.district || "-"}</h3>
                      <p className="mb-0 text-muted">{form.upazila || "-"} / {form.union || "-"}</p>
                    </article>
                    <article className="review-card">
                      <p className="review-label">Participants</p>
                      <h3>{grandTotal}</h3>
                      <p className="mb-0 text-muted">Male {totalMale} / Female {totalFemale}</p>
                    </article>
                    <article className="review-card">
                      <p className="review-label">Financial</p>
                      <h3>{formatCurrency(budgetValue)}</h3>
                      <p className="mb-0 text-muted">Expense {formatCurrency(expenseValue)}</p>
                    </article>
                    <article className="review-card">
                      <p className="review-label">Attachments</p>
                      <h3>{attachmentCount}</h3>
                      <p className="mb-0 text-muted">Photos {filesByCategory.Photos.length}</p>
                    </article>
                    <article className="review-card">
                      <p className="review-label">Status</p>
                      <h3>{hasFailedUploads ? "Needs attention" : hasPendingUploads ? "Uploading" : "Ready"}</h3>
                      <p className="mb-0 text-muted">{uploadCompleted}/{allUploads.length || 0} file(s) uploaded</p>
                    </article>
                  </div>

                  {getStepIssues("review").filter((issue) => issue !== "Confirm that all information is accurate.").length > 0 && (
                    <div className="review-issues">
                      <p className="mb-2 fw-semibold text-danger">Please fix these before submitting:</p>
                      {getStepIssues("review")
                        .filter((issue) => issue !== "Confirm that all information is accurate.")
                        .map((issue) => (
                          <p className="mb-1" key={issue}><i className="bi bi-exclamation-circle" /> {issue}</p>
                        ))}
                    </div>
                  )}

                  <label className="confirm-box mt-3">
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
              )}
            </article>
          </div>
        </section>

        <div className="wizard-bottom-bar">
          <button className="outline-btn" type="button" onClick={goBack}>
            <i className="bi bi-arrow-left" /> Back
          </button>
          <button className="outline-btn wizard-save-btn" type="button" onClick={onSaveDraft} disabled={savingDraft}>
            <i className="bi bi-cloud-arrow-down" /> {savingDraft ? "Saving" : "Save"}
          </button>
          {isReviewStep ? (
            <button className="primary-btn wizard-next-btn" type="submit" disabled={submitting}>
              <i className="bi bi-send-fill" /> {isEditMode ? "Update" : "Submit"}
            </button>
          ) : (
            <button className="primary-btn wizard-next-btn" type="button" onClick={goNext}>
              Next <i className="bi bi-arrow-right" />
            </button>
          )}
        </div>
      </form>
    </>
  );
};
