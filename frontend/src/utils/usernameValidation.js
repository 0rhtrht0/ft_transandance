export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 15

export function normalizeUsername(value) {
    return String(value ?? "").trim()
}

export function getUsernameValidationMessage(value) {
    const username = normalizeUsername(value)

    if (!username) {
        return ""
    }

    if (username.length < USERNAME_MIN_LENGTH) {
        return `Le pseudo doit contenir au moins ${USERNAME_MIN_LENGTH} caracteres.`
    }

    if (username.length > USERNAME_MAX_LENGTH) {
        return `Le pseudo ne peut pas depasser ${USERNAME_MAX_LENGTH} caracteres.`
    }

    return ""
}
