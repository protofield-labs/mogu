export type DbConfig = {
  instanceConnectionName: string;
  database: string;
  user: string;
  password: string;
};

export function readDbConfig(): DbConfig | null {
  const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!instanceConnectionName || !database || !user || !password) {
    return null;
  }

  return {
    instanceConnectionName,
    database,
    user,
    password,
  };
}
