import { fetchCurrentUser, getApiBase } from "./auth_api.js"
import { fetchGoogleClientConfig, loginWithGoogle } from "./auth_google_api.js"
import { storeAuthToken, storeSession, storeUserId } from "./auth_storage.js"
import { clearFeedback, showFeedback } from "./auth_ui.js"

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client"
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
let googleScriptPromise = null
let initializedGoogleClientId = null
const GOOGLE_LOGIN_ENABLED = String(import.meta.env.VITE_GOOGLE_LOGIN_ENABLED ?? "true").toLowerCase() !== "false"

function parseAllowedOrigins(raw) {
    if (typeof raw !== "string" || !raw.trim()) {
        return []
    }
    return raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
}

function isOriginAllowed(currentHref = window.location.href) {
    const configured = parseAllowedOrigins(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS)
    if (configured.length === 0) {
        // No explicit allow-list configured: keep backward compatibility.
        return true
    }
    const current = new URL(currentHref, window.location.origin)
    return configured.includes(current.origin)
}

function normalizeGoogleHref(currentHref = window.location.href) {
    return new URL(currentHref, window.location.origin)
}

function isLoopbackHost(hostname) {
    return LOOPBACK_HOSTS.has(String(hostname || "").trim().toLowerCase())
}

export function shouldUseGoogleRedirectMode(currentHref = window.location.href) {
    const current = normalizeGoogleHref(currentHref)
    return current.protocol === "https:" && !isLoopbackHost(current.hostname)
}

export function buildGoogleRedirectUrl(apiBase = getApiBase()) {
    return `${String(apiBase || "").replace(/\/+$/, "")}/auth/google/redirect`
}

export function buildGoogleSecureAuthUrl(currentHref = window.location.href) {
    const current = normalizeGoogleHref(currentHref)
    return `https://${current.hostname}:8443/auth`
}

function isRemoteInsecureContext(currentHref = window.location.href) {
    const current = normalizeGoogleHref(currentHref)
    return current.protocol !== "https:" && !isLoopbackHost(current.hostname)
}

function renderGoogleButtonFallback(googleButton, label) {
    googleButton.classList.remove("is-disabled", "is-rendered", "is-loading")
    googleButton.replaceChildren()

    const icon = document.createElement("span")
    icon.className = "google-icon"
    icon.textContent = "G"

    const text = document.createElement("span")
    text.textContent = label

    googleButton.append(icon, text)
}

function bindGoogleButtonActivation(googleButton, onActivate) {
    googleButton.onclick = typeof onActivate === "function" ? onActivate : null
    googleButton.onkeydown = typeof onActivate === "function"
        ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onActivate()
            }
        }
        : null
}

function setGoogleButtonState(googleButton, {
    label,
    disabled = false,
    loading = false,
    rendered = false,
    onActivate = null
}) {
    if (!rendered) {
        renderGoogleButtonFallback(googleButton, label)
    }

    googleButton.classList.toggle("is-disabled", disabled)
    googleButton.classList.toggle("is-loading", loading)
    googleButton.classList.toggle("is-rendered", rendered)
    googleButton.setAttribute("aria-disabled", disabled ? "true" : "false")
    googleButton.setAttribute("aria-busy", loading ? "true" : "false")
    googleButton.tabIndex = disabled && !onActivate ? -1 : 0
    bindGoogleButtonActivation(googleButton, onActivate)
}

export function loadGoogleIdentityScript() {
    if (window.google?.accounts?.id) {
        return Promise.resolve()
    }
    if (googleScriptPromise) {
        return googleScriptPromise
    }
    googleScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = GOOGLE_SCRIPT_SRC
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error("Google SDK load failed"))
        document.head.appendChild(script)
    })
    return googleScriptPromise
}

async function resolveGoogleClientState() {
    const envClientId = typeof import.meta.env.VITE_GOOGLE_CLIENT_ID === "string"
        ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()
        : ""
    if (envClientId) {
        return {
            status: "configured",
            clientId: envClientId
        }
    }

    try {
        const config = await fetchGoogleClientConfig()
        if (config?.enabled && config?.client_id) {
            return {
                status: "configured",
                clientId: config.client_id
            }
        }
        return {
            status: "unconfigured",
            clientId: ""
        }
    } catch (error) {
        console.warn("Failed to fetch google client config", error)
        return {
            status: "unreachable",
            clientId: "",
            error
        }
    }
}

export async function setupGoogleLogin({ googleButton, feedbackNode, navigateTo, onAuthUpdated }) {
    if (!googleButton) {
        return
    }

    if (!GOOGLE_LOGIN_ENABLED) {
        setGoogleButtonState(googleButton, {
            label: "Google disabled",
            disabled: true
        })
        clearFeedback(feedbackNode)
        return
    }

    let inFlight = false
    const handleCredential = async (response) => {
        if (!response?.credential) {
            showFeedback(feedbackNode, "Google sign-in was canceled.", "error")
            return
        }

        if (inFlight) {
            return
        }
        inFlight = true
        showFeedback(feedbackNode, "Signing in with Google...", "success")

        try {
            const auth = await loginWithGoogle(response.credential)
            storeAuthToken(auth?.access_token)
            if (auth?.access_token) {
                try {
                    const me = await fetchCurrentUser(auth.access_token)
                    if (me?.id) {
                        storeUserId(me.id)
                    }
                    if (me?.username) {
                        storeSession(me.username)
                    }
                    if (typeof onAuthUpdated === "function") {
                        onAuthUpdated()
                    }
                } catch (error) {
                    console.warn("Failed to fetch user after Google login", error)
                }
            }
            showFeedback(feedbackNode, "Sign-in successful. Redirecting...", "success")
            setTimeout(() => {
                navigateTo("menu")
            }, 250)
        } catch (error) {
            const raw = error?.message || "Google sign-in failed."
            const message = raw === "Failed to fetch" ? "Backend unavailable." : raw
            showFeedback(feedbackNode, message, "error")
        } finally {
            inFlight = false
        }
    }

    const mountGoogleButton = async () => {
        setGoogleButtonState(googleButton, {
            label: "Loading Google...",
            loading: true
        })

        const clientState = await resolveGoogleClientState()
        if (clientState.status === "unconfigured") {
            setGoogleButtonState(googleButton, {
                label: "Google unavailable",
                disabled: true
            })
            showFeedback(
                feedbackNode,
                "Google sign-in is not configured on the server.",
                "error"
            )
            return
        }

        if (clientState.status === "unreachable" || !clientState.clientId) {
            setGoogleButtonState(googleButton, {
                label: "Retry Google",
                onActivate: () => {
                    clearFeedback(feedbackNode)
                    void mountGoogleButton()
                }
            })
            clearFeedback(feedbackNode)
            return
        }

        try {
            await loadGoogleIdentityScript()
        } catch {
            setGoogleButtonState(googleButton, {
                label: "Reload Google",
                onActivate: () => {
                    clearFeedback(feedbackNode)
                    void mountGoogleButton()
                }
            })
            showFeedback(feedbackNode, "Unable to load Google Identity.", "error")
            return
        }

        if (!window.google?.accounts?.id) {
            setGoogleButtonState(googleButton, {
                label: "Reload Google",
                onActivate: () => {
                    clearFeedback(feedbackNode)
                    void mountGoogleButton()
                }
            })
            showFeedback(feedbackNode, "Google Identity is unavailable in this browser.", "error")
            return
        }

        if (isRemoteInsecureContext()) {
            setGoogleButtonState(googleButton, {
                label: "Open secure login",
                onActivate: () => {
                    window.location.assign(buildGoogleSecureAuthUrl())
                }
            })
            showFeedback(
                feedbackNode,
                "Google sign-in on remote devices requires the HTTPS gateway. Open the secure URL and try again.",
                "error"
            )
            return
        }

        if (!isOriginAllowed()) {
            const configured = parseAllowedOrigins(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS)
            const allowedHint = configured.length > 0 ? ` Allowed origins: ${configured.join(", ")}.` : ""
            setGoogleButtonState(googleButton, {
                label: "Google unavailable",
                disabled: true
            })
            showFeedback(
                feedbackNode,
                `Google sign-in is disabled for this origin (${window.location.origin}).${allowedHint}`,
                "error"
            )
            return
        }

        googleButton.replaceChildren()
        setGoogleButtonState(googleButton, {
            label: "",
            rendered: true
        })

        const initOptions = {
            client_id: clientState.clientId,
            auto_select: false,
            cancel_on_tap_outside: true
        }
        if (shouldUseGoogleRedirectMode()) {
            initOptions.ux_mode = "redirect"
            initOptions.login_uri = buildGoogleRedirectUrl()
        } else {
            initOptions.callback = handleCredential
        }

        if (initializedGoogleClientId !== clientState.clientId) {
            window.google.accounts.id.initialize(initOptions)
            initializedGoogleClientId = clientState.clientId
        }

        window.google.accounts.id.renderButton(googleButton, {
            theme: "filled_black",
            size: "large",
            text: "continue_with",
            shape: "pill",
            logo_alignment: "left",
            width: 320
        })
    }

    await mountGoogleButton()
}
