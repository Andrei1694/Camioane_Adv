export function loadProxyConfig(env: NodeJS.ProcessEnv = process.env) {
  // Set only behind a proxy that overwrites this header (Railway: x-real-ip).
  const clientIpHeader = env.CLIENT_IP_HEADER?.trim().toLowerCase() || null;
  if (clientIpHeader !== null && !/^[a-z0-9-]+$/.test(clientIpHeader)) {
    throw new Error('CLIENT_IP_HEADER must contain only letters, digits, and hyphens.');
  }
  return { clientIpHeader };
}
