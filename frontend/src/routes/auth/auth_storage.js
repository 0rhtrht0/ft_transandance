export const STORAGE_KEYS = {
    users: "bh_users",
    sessionName: "playerName",
    username: "bh_username",
    accessToken: "accessToken",
    userId: "userId"
}

export function storeSession(username) {
    localStorage.setItem(STORAGE_KEYS.sessionName, username)
    localStorage.setItem(STORAGE_KEYS.username, username)
}

export function storeAuthToken(token) {
    if (!token) {
        return
    }
    localStorage.setItem(STORAGE_KEYS.accessToken, token)
}

export function storeUserId(userId) {
    if (!userId && userId !== 0) {
        return
    }
    localStorage.setItem(STORAGE_KEYS.userId, String(userId))
}

export function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.sessionName)
    localStorage.removeItem(STORAGE_KEYS.username)
    localStorage.removeItem(STORAGE_KEYS.accessToken)
    localStorage.removeItem(STORAGE_KEYS.userId)
}

export function clearSessionAndNotify() {
    clearSession()
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:updated"))
    }
}

export function getStoredToken() {
    return localStorage.getItem(STORAGE_KEYS.accessToken)
}
