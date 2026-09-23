import { S3Client } from "@aws-sdk/client-s3";

import { getR2Config } from "@/lib/r2/config";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;

  const config = getR2Config();

  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return client;
}
