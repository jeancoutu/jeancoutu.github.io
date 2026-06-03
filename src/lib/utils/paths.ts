export const BASE = import.meta.env.BASE_URL;

// Absolute app url for a logical route segment (e.g. "/planner", "/meal/123")
export function appPath(segment: string): string {
    const clean = segment.replace(/^\//, "");
    const prefix = BASE.endsWith("/") ? BASE : `${BASE}/`;
    return `${prefix}${clean}`.replace(/\/{2,}/g, "/");
}

export function stripBase(pathname: string): string {
    if (BASE === "/") return pathname;
    const baseNoSlash = BASE.replace(/\/$/, "");
    if (pathname === baseNoSlash) return "/";
    if (pathname.startsWith(baseNoSlash)) {
        return pathname.slice(baseNoSlash.length) || "/";
    }
    return pathname;
}

export function isAppRoot(pathname: string): boolean {
    const normalized = stripBase(pathname).replace(/\/$/, "") || "/";
    return normalized === "/";
}