export interface PostResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Human-readable reason, already in Czech, or null when the call worked. */
  error: string | null;
}

/**
 * POSTs JSON and always comes back with something sayable.
 *
 * Distinguishes the three failures that look identical from inside a `catch`:
 * the request never left (offline), the server answered with an error, and the
 * server answered with something that isn't JSON at all — which is what an
 * unhandled exception or a stray redirect looks like from here.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<PostResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Server neodpověděl. Zkontroluj připojení.",
    };
  }

  const text = await response.text();

  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return {
      ok: false,
      status: response.status,
      data: null,
      error:
        `Server vrátil HTTP ${response.status} a odpověď, která není JSON. ` +
        (snippet ? `Začátek odpovědi: „${snippet.slice(0, 160)}"` : ""),
    };
  }

  const data = parsed as (T & { error?: string }) | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: data?.error ?? `Server vrátil HTTP ${response.status}.`,
    };
  }

  return { ok: true, status: response.status, data, error: null };
}
