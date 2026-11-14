import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config';

// Armazenamento de objetos: S3/MinIO em producao, disco local em desenvolvimento.
export interface Storage {
  init(): Promise<void>;
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

const local: Storage = {
  async init() { fs.mkdirSync(config.storage.uploadDir, { recursive: true }); },
  async put(key, data) { await fs.promises.writeFile(path.join(config.storage.uploadDir, path.basename(key)), data); },
  async get(key) { return fs.createReadStream(path.join(config.storage.uploadDir, path.basename(key))); },
  async remove(key) { await fs.promises.rm(path.join(config.storage.uploadDir, path.basename(key)), { force: true }); },
};

function s3(): Storage {
  const c = config.storage;
  const client = new S3Client({
    region: c.region, endpoint: c.endpoint || undefined, forcePathStyle: true,
    credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
  });
  return {
    async init() {
      try { await client.send(new HeadBucketCommand({ Bucket: c.bucket })); }
      catch { await client.send(new CreateBucketCommand({ Bucket: c.bucket })); }
    },
    async put(key, data, mime) { await client.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: data, ContentType: mime })); },
    async get(key) { const r = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key })); return r.Body as Readable; },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key })); },
  };
}

export const storage: Storage = config.storage.driver === 's3' ? s3() : local;
