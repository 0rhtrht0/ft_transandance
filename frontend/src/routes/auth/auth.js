import {
    fetchCurrentUser,
    loginBackend,
    requestPasswordReset,
    resetPasswordWithToken,
    signupBackend
} from "./auth_api.js"
import { setupGoogleLogin } from "./auth_google.js"
import {
    STORAGE_KEYS,
    clearSession,
    getStoredToken,
    storeAuthToken,
    storeSession,
    storeUserId
} from "./auth_storage.js"
import {
    clearFeedback,
    isValidEmail,
    setRegisterFieldsVisibility,
    setupAuthParallax,
    showFeedback,
    customPrompt
} from "./auth_ui.js"
import { USERNAME_MAX_LENGTH, getUsernameValidationMessage } from "../../utils/usernameValidation.js"

let mode = "login"
let goToFn = null
let isSubmitting = false
const LOGIN_IDENTIFIER_MAX_LENGTH = 254

export function init_auth(goTo) {
    goToFn = goTo

    const authScene = document.querySelector(".auth-scene")
    const usernameInput = document.getElementById("username")
    const emailInput = document.getElementById("email")
    const passwordInput = document.getElementById("password")
    const confirmPasswordInput = document.getElementById("confirm-password")

    const form = document.getElementById("auth-form")
    const tabLogin = document.getElementById("tab-login")
    const tabRegister = document.getElementById("tab-register")
    const submitButton = document.getElementById("submit-btn")
    const guestButton = document.getElementById("guest-btn")
    const forgotPasswordButton = document.getElementById("forgot-password-btn")
    const feedbackNode = document.getElementById("auth-feedback")
    const googleButton = document.getElementById("google-btn")
    const disposeParallax = setupAuthParallax(authScene)

    const notifyAuthUpdated = () => {
        window.dispatchEvent(new CustomEvent("auth:updated"))
    }

    const navigateTo = (route) => {
        disposeParallax()
        goToFn(route)
    }

    const persistAuthenticatedUser = (user, token = null) => {
        if (token) {
            storeAuthToken(token)
        }
        if (user?.id) {
            storeUserId(user.id)
        }
        if (user?.username) {
            storeSession(user.username)
        }
        notifyAuthUpdated()
    }

    const setMode = (nextMode) => {
        mode = nextMode
        const isRegisterMode = mode === "register"

        tabLogin.classList.toggle("active", !isRegisterMode)
        tabRegister.classList.toggle("active", isRegisterMode)
        if (isRegisterMode) {
            submitButton.textContent = "Sign up"
        } else {
            submitButton.textContent = "Sign in"
        }
        if (forgotPasswordButton) {
            if (isRegisterMode) {
                forgotPasswordButton.style.display = "none"
            } else {
                forgotPasswordButton.style.display = "inline-block"
            }
        }

        setRegisterFieldsVisibility({
            isRegisterMode,
            emailInput,
            confirmPasswordInput,
            passwordInput
        })

        if (usernameInput) {
            if (isRegisterMode) {
                usernameInput.placeholder = "Username"
                usernameInput.maxLength = USERNAME_MAX_LENGTH
            } else {
                usernameInput.placeholder = "Username or email"
                usernameInput.maxLength = LOGIN_IDENTIFIER_MAX_LENGTH
            }
        }

        clearFeedback(feedbackNode)
    }

    setMode("login")

    ;[usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
        input.addEventListener("input", () => clearFeedback(feedbackNode))
    })

    tabLogin.addEventListener("click", () => {
        setMode("login")
    })

    tabRegister.addEventListener("click", () => {
        setMode("register")
    })

    form.addEventListener("submit", async (event) => {
        event.preventDefault()

        if (isSubmitting) {
            return
        }

        const identifier = usernameInput.value.trim()
        const password = passwordInput.value

        if (!identifier || !password) {
            showFeedback(feedbackNode, "Please enter your username or email, then your password.")
            return
        }

        if (mode === "register") {
            const username = identifier
            const usernameValidationMessage = getUsernameValidationMessage(username)
            if (usernameValidationMessage) {
                showFeedback(feedbackNode, usernameValidationMessage)
                return
            }

            const email = emailInput.value.trim().toLowerCase()
            const confirmPassword = confirmPasswordInput.value

            if (!email) {
                showFeedback(feedbackNode, "Please enter a valid email.")
                return
            }

            if (!isValidEmail(email)) {
                showFeedback(feedbackNode, "Please enter a valid email.")
                return
            }

            if (password.length < 8) {
                showFeedback(feedbackNode, "Password must contain at least 8 characters.")
                return
            }

            if (password !== confirmPassword) {
                showFeedback(feedbackNode, "Passwords do not match.")
                return
            }

            try {
                await signupBackend({ username, email, password })
                showFeedback(feedbackNode, "Sign-up successful. Signing you in...", "success")
            } catch (error) {
                const message = error?.message || "Unable to create the account."
                showFeedback(feedbackNode, message)
                return
            }
        }

        isSubmitting = true
        submitButton.disabled = true
        if (googleButton) {
            googleButton.disabled = true
        }

        try {
            const auth = await loginBackend({ identifier, password })
            storeSession(identifier)
            storeAuthToken(auth?.access_token)
            if (auth?.access_token) {
                try {
                    const me = await fetchCurrentUser(auth.access_token)
                    persistAuthenticatedUser(me)
                } catch (error) {
                    console.warn("Failed to fetch user after login", error)
                }
            }
            showFeedback(feedbackNode, "Sign-in successful. Redirecting...", "success")
            setTimeout(() => {
                navigateTo("menu")
            }, 250)
        } catch (error) {
            const raw = error?.message || "Unable to sign in."
            const message = raw === "Failed to fetch" ? "Backend unavailable." : raw
            showFeedback(feedbackNode, message)
        } finally {
            isSubmitting = false
            submitButton.disabled = false
            if (googleButton) {
                googleButton.disabled = false
            }
        }
    })

    guestButton.addEventListener("click", () => {
        clearSession()
        localStorage.setItem(STORAGE_KEYS.sessionName, "Guest")
        navigateTo("menu")
    })

    if (forgotPasswordButton) {
        forgotPasswordButton.addEventListener("click", async () => {
            const email = await customPrompt("Enter your email to reset your password:", "", "email")
            if (!email) {
                return
            }

            try {
                const resetRequest = await requestPasswordReset(email.trim().toLowerCase())
                if (resetRequest?.reset_token) {
                    console.log(`[DEV] Reset link: https://localhost:8443/auth?reset_token=${resetRequest.reset_token}`)
                }

                showFeedback(
                    feedbackNode,
                    "If the account exists, a reset link was sent to your email address. Please check your inbox.",
                    "success"
                )
            } catch (error) {
                const raw = error?.message || "Password reset failed."
                const message = raw === "Failed to fetch" ? "Backend unavailable." : raw
                showFeedback(feedbackNode, message)
            }
        })
    }

    const handleInitialAuthState = async () => {
        const urlParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
        const urlResetToken = urlParams.get("reset_token")
        const googleRedirectToken = hashParams.get("google_access_token")
        const googleRedirectUserId = hashParams.get("google_user_id")
        const googleRedirectUsername = hashParams.get("google_username")
        const googleRedirectError = hashParams.get("google_error")

        if (urlResetToken) {
            window.history.replaceState({}, document.title, "/auth")

            setTimeout(async () => {
                try {
                    const newPassword = await customPrompt("New password (minimum 8 characters):", "", "password")
                    if (!newPassword) {
                        showFeedback(feedbackNode, "Password reset canceled.")
                        return
                    }
                    if (newPassword.length < 8) {
                        showFeedback(feedbackNode, "Password must contain at least 8 characters.")
                        return
                    }

                    const confirmPassword = await customPrompt("Confirm the new password:", "", "password")
                    if (newPassword !== confirmPassword) {
                        showFeedback(feedbackNode, "Passwords do not match.")
                        return
                    }

                    await resetPasswordWithToken(urlResetToken, newPassword)
                    showFeedback(feedbackNode, "Password reset complete. You can sign in now.", "success")
                } catch (error) {
                    const raw = error?.message || "Password reset failed."
                    const message = raw === "Failed to fetch" ? "Backend unavailable." : raw
                    showFeedback(feedbackNode, message)
                }
            }, 300)
            return
        }

        if (googleRedirectToken || googleRedirectError) {
            window.history.replaceState({}, document.title, "/auth")
        }

        if (googleRedirectError) {
            showFeedback(feedbackNode, googleRedirectError, "error")
            clearSession()
            notifyAuthUpdated()
            return
        }

        if (googleRedirectToken) {
            storeAuthToken(googleRedirectToken)
            if (googleRedirectUserId) {
                storeUserId(googleRedirectUserId)
            }
            if (googleRedirectUsername) {
                storeSession(googleRedirectUsername)
            }

            try {
                const user = await fetchCurrentUser(googleRedirectToken)
                persistAuthenticatedUser(user, googleRedirectToken)
                showFeedback(feedbackNode, "Sign-in successful. Redirecting...", "success")
                navigateTo("menu")
            } catch (error) {
                clearSession()
                notifyAuthUpdated()
                const raw = error?.message || "Google sign-in failed."
                const message = raw === "Failed to fetch" ? "Backend unavailable." : raw
                showFeedback(feedbackNode, message, "error")
            }
            return
        }

        const storedToken = getStoredToken()
        if (!storedToken) {
            const currentSessionName = localStorage.getItem(STORAGE_KEYS.sessionName)
            if (currentSessionName === "Guest" || currentSessionName === "Invited") {
                navigateTo("menu")
            } else {
                clearSession()
                notifyAuthUpdated()
            }
            return
        }

        try {
            const user = await fetchCurrentUser(storedToken)
            persistAuthenticatedUser(user)
            navigateTo("menu")
        } catch {
            const currentSessionName = localStorage.getItem(STORAGE_KEYS.sessionName)
            if (currentSessionName === "Guest" || currentSessionName === "Invited") {
                navigateTo("menu")
                return
            }
            clearSession()
            notifyAuthUpdated()
        }
    }

    void handleInitialAuthState()

    setupGoogleLogin({
        googleButton,
        feedbackNode,
        navigateTo,
        onAuthUpdated: notifyAuthUpdated
    })
}
