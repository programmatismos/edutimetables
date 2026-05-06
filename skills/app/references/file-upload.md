# File Upload (R2)

## Setup

Uses Cloudflare R2 via S3-compatible API with presigned URLs. Files upload directly from the client to R2 — never through the API server.

### Env vars (root `.env`)

```
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

### S3 Client (`packages/web/src/api/lib/s3.ts`)

```ts
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

## API Route — Generate Presigned URL

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./lib/s3";

// Chain on the main app instance
.post("/upload/presign", async (c) => {
  const { filename, contentType } = await c.req.json();
  const key = `uploads/${Date.now()}-${filename}`;

  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 600 });

  return c.json({ url, key }, 200);
})
```

## Web — Upload

```tsx
const upload = async (file: File) => {
  const res = await api.upload.presign.$post({
    json: { filename: file.name, contentType: file.type },
  });
  const { url, key } = await res.json();

  await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  return key;
};
```

## Mobile — Upload

```tsx
import * as ImagePicker from "expo-image-picker";

const upload = async (uri: string, filename: string, contentType: string) => {
  const res = await api.upload.presign.$post({
    json: { filename, contentType },
  });
  const { url, key } = await res.json();

  const file = await fetch(uri);
  const blob = await file.blob();

  await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });

  return key;
};
```

## Install

```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
