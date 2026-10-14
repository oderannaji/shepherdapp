// Small native-fetch adapter: the edge function needs only verified identity,
// RPCs and two mail operations. No runtime package download is required.
export function accountClients(url, publicKey, serviceKey) {
  const root = url.replace(/\/$/, "");
  function forToken(token, apiKey = publicKey) {
    async function request(path, body) {
      try {
        const response = await fetch(root + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(15000),
        });
        const raw = await response.text();
        const data = raw ? JSON.parse(raw) : null;
        return response.ok
          ? { data, error: null }
          : { data: null, error: { code: data?.code ?? String(response.status) } };
      } catch {
        return { data: null, error: { code: "connection_failed" } };
      }
    }
    return {
      rpc: (name, body) => request(`/rest/v1/rpc/${name}`, body),
      auth: {
        getUser: async () => {
          const r = await request("/auth/v1/user");
          return { data: { user: r.data }, error: r.error };
        },
        resetPasswordForEmail: (email, { redirectTo }) =>
          request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email }),
        admin: {
          inviteUserByEmail: async (email, { redirectTo }) => {
            const r = await request(
              `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
              { email },
            );
            return { data: { user: r.data }, error: r.error };
          },
        },
      },
    };
  }
  return { clientForToken: (token) => forToken(token), admin: forToken(serviceKey, serviceKey) };
}
