import { describe, expect, it } from "vitest";

import {
    buildGoogleRedirectUrl,
    buildGoogleSecureAuthUrl,
    shouldUseGoogleRedirectMode,
} from "../routes/auth/auth_google.js";


describe("auth_google", () => {
    it("uses redirect mode on remote HTTPS", () => {
        expect(shouldUseGoogleRedirectMode("https://10.0.0.8:8443/auth")).toBe(true);
    });

    it("keeps callback mode on localhost", () => {
        expect(shouldUseGoogleRedirectMode("http://localhost:5173/auth")).toBe(false);
        expect(shouldUseGoogleRedirectMode("https://localhost:8443/auth")).toBe(false);
    });

    it("builds the backend redirect endpoint from the API base", () => {
        expect(buildGoogleRedirectUrl("https://10.0.0.8:8443")).toBe(
            "https://10.0.0.8:8443/auth/google/redirect"
        );
    });

    it("recommends the secure remote auth entrypoint", () => {
        expect(buildGoogleSecureAuthUrl("http://10.0.0.8:5173/auth")).toBe(
            "https://10.0.0.8:8443/auth"
        );
    });
});
