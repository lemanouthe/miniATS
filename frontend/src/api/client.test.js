import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, refreshClient, tokenStorage } from "./client";
import { TOKENS } from "../test/fixtures";

const FRESH = "fresh-access-token";

const ok = (config, data) => Promise.resolve({ data, status: 200, statusText: "OK", headers: {}, config });
const unauthorized = (config) =>
  Promise.reject(Object.assign(new Error("401"), { config, response: { status: 401, data: {}, config } }));

describe("intercepteur de refresh", () => {
  const originalApiAdapter = api.defaults.adapter;
  const originalRefreshAdapter = refreshClient.defaults.adapter;

  beforeEach(() => {
    tokenStorage.set(TOKENS);
    api.defaults.adapter = (config) =>
      config.headers.Authorization === `Bearer ${FRESH}` ? ok(config, { url: config.url }) : unauthorized(config);
  });

  afterEach(() => {
    api.defaults.adapter = originalApiAdapter;
    refreshClient.defaults.adapter = originalRefreshAdapter;
  });

  it("ne lance qu'un seul refresh pour plusieurs 401 simultanés", async () => {
    const refreshAdapter = vi.fn((config) => ok(config, { access: FRESH }));
    refreshClient.defaults.adapter = refreshAdapter;

    const responses = await Promise.all([api.get("/a/"), api.get("/b/"), api.get("/c/")]);

    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(responses.map((r) => r.data.url)).toEqual(["/a/", "/b/", "/c/"]);
    expect(tokenStorage.access).toBe(FRESH);
  });

  it("déconnecte l'utilisateur si le refresh échoue", async () => {
    refreshClient.defaults.adapter = (config) => unauthorized(config);
    const onLogout = vi.fn();
    window.addEventListener("auth:logout", onLogout);

    await expect(api.get("/a/")).rejects.toBeTruthy();

    expect(onLogout).toHaveBeenCalled();
    expect(tokenStorage.access).toBeNull();
    expect(tokenStorage.refresh).toBeNull();
    window.removeEventListener("auth:logout", onLogout);
  });

  it("ne tente pas de refresh sur l'appel de connexion", async () => {
    const refreshAdapter = vi.fn();
    refreshClient.defaults.adapter = refreshAdapter;

    await expect(api.post("/auth/token/", {})).rejects.toBeTruthy();
    expect(refreshAdapter).not.toHaveBeenCalled();
  });
});
