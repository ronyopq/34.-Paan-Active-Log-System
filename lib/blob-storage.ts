import { BlobServiceClient, ContainerClient } from "../node_modules/@azure/storage-blob/dist/commonjs/index.js";

const connectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || "").trim();
const configuredContainer = (process.env.AZURE_STORAGE_CONTAINER || "activities").trim().toLowerCase();
const containerName = configuredContainer.replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || "activities";

declare global {
  var __pamsBlobServiceClient: BlobServiceClient | undefined;
  var __pamsBlobContainerPromise: Promise<ContainerClient> | undefined;
}

const createServiceClient = () => {
  if (!connectionString) return null;
  return BlobServiceClient.fromConnectionString(connectionString);
};

const serviceClient = globalThis.__pamsBlobServiceClient ?? createServiceClient();
if (serviceClient && !globalThis.__pamsBlobServiceClient) {
  globalThis.__pamsBlobServiceClient = serviceClient;
}

export const hasBlobStorageConfig = Boolean(serviceClient && containerName);

const getContainerClient = async () => {
  if (!serviceClient) {
    throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING env");
  }

  if (!globalThis.__pamsBlobContainerPromise) {
    globalThis.__pamsBlobContainerPromise = (async () => {
      const client = serviceClient.getContainerClient(containerName);
      await client.createIfNotExists();
      return client;
    })();
  }

  try {
    return await globalThis.__pamsBlobContainerPromise;
  } catch (error) {
    globalThis.__pamsBlobContainerPromise = undefined;
    throw error;
  }
};

const sanitizeFileName = (value: string) =>
  String(value || "file")
    .replace(/[^\w.\- ]+/g, "")
    .trim() || "file";

export const createBlobFileId = (originalName: string) => {
  const sanitizedName = sanitizeFileName(originalName);
  const ext = sanitizedName.includes(".") ? sanitizedName.split(".").pop() || "bin" : "bin";
  const safeExt = ext.replace(/[^\w-]+/g, "").toLowerCase() || "bin";
  return `f_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}.${safeExt}`;
};

export const uploadBlobFile = async (input: {
  fileId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}) => {
  const container = await getContainerClient();
  const client = container.getBlockBlobClient(input.fileId);

  await client.uploadData(input.data, {
    blobHTTPHeaders: {
      blobContentType: input.mimeType
    },
    metadata: {
      originalname: encodeURIComponent(sanitizeFileName(input.fileName))
    }
  });

  return {
    fileId: input.fileId
  };
};

const streamToBuffer = async (stream: NodeJS.ReadableStream | null) => {
  if (!stream) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

export const getBlobFile = async (fileId: string) => {
  const container = await getContainerClient();
  const client = container.getBlockBlobClient(fileId);

  if (!(await client.exists())) {
    return null;
  }

  const [download, properties] = await Promise.all([client.download(), client.getProperties()]);
  const body = await streamToBuffer(download.readableStreamBody ?? null);
  const fileName = properties.metadata?.originalname
    ? decodeURIComponent(properties.metadata.originalname)
    : fileId;

  return {
    body,
    fileName,
    contentType: properties.contentType || "application/octet-stream"
  };
};
