function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getR2Config() {
  const accountId = requireServerEnv("R2_ACCOUNT_ID");
  return {
    accountId,
    accessKeyId: requireServerEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireServerEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireServerEnv("R2_BUCKET_NAME"),
    endpoint:
      process.env.R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() || null,
  };
}
