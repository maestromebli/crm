export type AppEnv = {
  DATABASE_URL: string;
};

export function loadEnv(): AppEnv {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return { DATABASE_URL };
}

