import { resolveApiBase, resolveWsBase } from "../utils/runtimeEndpoints.js";


describe("runtimeEndpoints", () => {
    it("rewrites localhost API targets to the HTTPS gateway", () => {
        expect(resolveApiBase("http://localhost:8001", "http://192.168.1.24:5173/ingame")).toBe(
            "https://192.168.1.24:8443"
        );
    });

    it("uses the current HTTPS origin to avoid mixed content", () => {
        expect(resolveApiBase("http://localhost:8000", "https://10.0.0.8:8443/")).toBe(
            "https://10.0.0.8:8443"
        );
    });

    it("rewrites websocket targets for the secure gateway", () => {
        expect(resolveWsBase("http://localhost:8000", "http://192.168.1.24:5173/ingame")).toBe(
            "wss://192.168.1.24:8443"
        );
    });

    it("uses secure websocket origin when the page is served over HTTPS", () => {
        expect(resolveWsBase("localhost:8000", "https://10.0.0.8:8443/")).toBe("wss://10.0.0.8:8443");
    });
});
