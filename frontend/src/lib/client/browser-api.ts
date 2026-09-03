"use client";

import axios, { type AxiosResponse } from "axios";

export type BrowserResponse = AxiosResponse<unknown>;

/** Browser -> same-origin Next.js BFF. Authentication stays in HttpOnly cookies. */
export const browserApi = axios.create({
  baseURL: "/",
  adapter: "fetch",
  // Keep HTTP failures available to the existing status-specific UI branches.
  validateStatus: () => true,
  // Parse explicitly below: malformed JSON must not silently become a string.
  responseType: "text",
  transformResponse: [(data: unknown) => data],
  headers: {
    Accept: "*/*",
    "Content-Type": false,
    "User-Agent": false,
  },
  // Do not introduce Axios' automatic XSRF cookie/header convention.
  withXSRFToken: false,
  // No withCredentials override: the fetch adapter defaults to same-origin.
  timeout: 0,
});

browserApi.interceptors.request.use((config) => {
  const url = config.url ?? "";
  if (
    config.baseURL !== "/" ||
    !url.startsWith("/api/") ||
    url.includes("\\") ||
    !new URL(url, "https://bff.invalid").pathname.startsWith("/api/")
  ) {
    throw new TypeError("browserApi requires a relative /api/ BFF URL");
  }
  return config;
});

export function isSuccessfulResponse(response: BrowserResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

/** Also decodes JSON errors returned by binary download endpoints. */
export async function readBrowserJson(
  response: BrowserResponse,
): Promise<unknown> {
  const text =
    response.data instanceof Blob ? await response.data.text() : response.data;
  if (typeof text !== "string") {
    throw new TypeError("Expected a text or Blob response");
  }
  return JSON.parse(text) as unknown;
}
