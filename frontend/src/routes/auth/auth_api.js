import { getApiBase, getWsBase } from "../../utils/runtimeEndpoints.js"

export { getApiBase, getWsBase }

export async function readErrorDetail(response) {
    let detail = `Error ${response.status}`
    if ([502, 503, 504].includes(response.status)) {
        return "Backend unavailable."
    }
    try {
        const data = await response.json()
        if (data && typeof data.detail === "string") {
            detail = data.detail
            const retryAfter = response.headers.get("Retry-After")
            if (response.status === 429 && retryAfter) {
                detail = `${detail} Retry in ${retryAfter}s.`
            }
        }
    } catch {

    }

    if (detail === "Incorrect username or password") {
        return "Incorrect username, email, or password."
    }
    if (detail === "Could not validate credentials") {
        return "Invalid session. Please sign in again."
    }
    if (detail.startsWith("Too many failed login attempts.")) {
        return detail.replace("Too many failed login attempts. Try again later.", "Too many login attempts.")
    }
    return detail
}

export async function signupBackend({ username, email, password }) {
    const response = await fetch(`${getApiBase()}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
        credentials: "include"
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
}

export async function loginBackend({ identifier, username, password }) {
    const loginIdentifier = String(identifier ?? username ?? "").trim()
    const response = await fetch(`${getApiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: loginIdentifier, password }),
        credentials: "include"
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
    return response.json()
}

export async function fetchCurrentUser(token) {
    const headers = {}
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }
    const response = await fetch(`${getApiBase()}/auth/me`, {
        credentials: "include",
        headers
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
    return response.json()
}

export async function requestPasswordReset(email) {
    const response = await fetch(`${getApiBase()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include"
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
    return response.json()
}

export async function resetPasswordWithToken(token, newPassword) {
    const response = await fetch(`${getApiBase()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
        credentials: "include"
    })
    if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw new Error(detail)
    }
    return response.json()
}
