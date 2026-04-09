const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_HTTPS_PORT = "8443";

function trimTrailingSlashes(value) {
    return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeHostname(hostname) {
    return String(hostname || "").trim().replace(/^\[|\]$/g, "").toLowerCase();
}

function isLoopbackHostname(hostname) {
    return LOOPBACK_HOSTS.has(normalizeHostname(hostname));
}

function stripApiSuffix(pathname) {
    if (!pathname) {
        return "";
    }
    return pathname.replace(/\/api\/?$/i, "/");
}

function getSecureGatewayHost(current) {
    if (current.protocol === "https:") {
        return current.host;
    }
    return `${current.hostname}:${DEFAULT_HTTPS_PORT}`;
}

function buildAbsoluteUrl(rawValue, protocol) {
    const value = trimTrailingSlashes(rawValue);
    if (!value) {
        return null;
    }

    try {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            return new URL(value);
        }
        if (/^\/\//.test(value)) {
            return new URL(`${protocol}${value}`);
        }
        if (!value.startsWith("/")) {
            return new URL(`${protocol}//${value}`);
        }
        return new URL(value, window.location.origin);
    } catch {
        return null;
    }
}

function rewriteForRuntime(url, kind, currentHref) {
    const current = new URL(currentHref || window.location.href);
    const pageIsSecure = current.protocol === "https:";
    const targetIsLoopback = isLoopbackHostname(url.hostname);

    if (pageIsSecure) {
        url.protocol = kind === "ws" ? "wss:" : "https:";
        url.host = current.host;
        return url;
    }

    if (targetIsLoopback) {
        url.hostname = current.hostname;
        url.protocol = kind === "ws" ? "wss:" : "https:";
        url.host = getSecureGatewayHost(current);
    }

    return url;
}

export function resolveApiBase(rawValue = import.meta.env.VITE_API_URL, currentHref = window.location.href) {
    const explicitUrl = buildAbsoluteUrl(rawValue, "http:");
    if (explicitUrl) {
        return trimTrailingSlashes(rewriteForRuntime(explicitUrl, "api", currentHref).toString());
    }

    const current = new URL(currentHref);
    if (current.protocol === "https:") {
        return trimTrailingSlashes(current.origin);
    }
    return `https://${getSecureGatewayHost(current)}`;
}

export function resolveWsBase(
    rawValue = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL,
    currentHref = window.location.href
) {
    const explicitUrl = buildAbsoluteUrl(rawValue, "ws:");
    if (explicitUrl) {
        if (explicitUrl.protocol === "http:") {
            explicitUrl.protocol = "ws:";
        } else if (explicitUrl.protocol === "https:") {
            explicitUrl.protocol = "wss:";
        }
        explicitUrl.pathname = stripApiSuffix(explicitUrl.pathname || "");
        return trimTrailingSlashes(rewriteForRuntime(explicitUrl, "ws", currentHref).toString());
    }

    const current = new URL(currentHref);
    if (current.protocol === "https:") {
        return `wss://${current.host}`;
    }
    return `wss://${getSecureGatewayHost(current)}`;
}

export function getApiBase() {
    return resolveApiBase();
}

export function getWsBase() {
    return resolveWsBase();
}
