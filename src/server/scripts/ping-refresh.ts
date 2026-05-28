const appHostport = process.env.APP_HOSTPORT;
const refreshToken = process.env.REFRESH_TOKEN;

async function run() {
  if (!appHostport) {
    throw new Error("APP_HOSTPORT is required.");
  }

  const response = await fetch(`http://${appHostport}/api/internal/refresh`, {
    method: "POST",
    headers: refreshToken
      ? {
          "x-refresh-token": refreshToken
        }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Refresh ping failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { generatedAt: string };
  console.log(`Dashboard refreshed at ${payload.generatedAt}`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
