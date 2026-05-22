async function http<T>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (init?.params) {
    for (const [k, v] of Object.entries(init.params)) {
      if (v !== undefined) url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let detail: unknown = null
    try {
      detail = await res.json()
    } catch {}
    throw Object.assign(new Error(`${res.status} ${res.statusText}`), {
      detail,
    })
  }
  return res.json() as Promise<T>
}

async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(path, { method: "POST", body: form })
  if (!res.ok) {
    let detail: unknown = null
    try {
      detail = await res.json()
    } catch {}
    throw Object.assign(new Error(`${res.status} ${res.statusText}`), {
      detail,
    })
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | undefined>) =>
    http<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) =>
    http<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    http<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => http<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => upload<T>(path, file),
}
