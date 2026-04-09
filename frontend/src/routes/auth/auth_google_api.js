import { getApiBase, readErrorDetail } from "./auth_api.js"

export async function fetchGoogleClientConfig() {
    const response = await fetch(`${getApiBase()}/auth/google/config`, {
        credentials: "include"
    })

    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }

    const data = await response.json()
    return {
        enabled: Boolean(data?.enabled),
        client_id: typeof data?.client_id === "string" ? data.client_id : ""
    }
}

export async function loginWithGoogle(credential) {
    const response = await fetch(`${getApiBase()}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
        credentials: "include"
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
    return response.json()
}
