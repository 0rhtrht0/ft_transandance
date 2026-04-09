import { describe, expect, it } from "vitest";

import {
    USERNAME_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
    getUsernameValidationMessage,
    normalizeUsername
} from "../utils/usernameValidation.js";

describe("usernameValidation", () => {
    it("normalizes surrounding whitespace", () => {
        expect(normalizeUsername("  Neo  ")).toBe("Neo");
    });

    it("rejects usernames shorter than the minimum length", () => {
        expect(getUsernameValidationMessage("ab")).toBe(
            `Le pseudo doit contenir au moins ${USERNAME_MIN_LENGTH} caracteres.`
        );
    });

    it("rejects usernames longer than the maximum length", () => {
        expect(getUsernameValidationMessage("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(
            `Le pseudo ne peut pas depasser ${USERNAME_MAX_LENGTH} caracteres.`
        );
    });

    it("accepts usernames within the allowed range", () => {
        expect(getUsernameValidationMessage("BlackHole42")).toBe("");
    });
});
