import toast from "react-hot-toast";

export class ApiError extends Error {
  httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

export async function apiFetch(endpoint: string, options: any = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    body:
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body),
    headers,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: any) {
    // ignore
  }

  if (!response.ok) {
    const message = json?.error ?? `HTTP error! status: ${response.status}`;
    if (!options.hideToast) {
      toast.error(message.slice(0, 200));
    }

    throw new ApiError(message, response.status);
  }

  return json;
}

export const apiGet = (
  endpoint: string,
  queryParams?: Record<string, string>,
  options: any = {}
) => {
  return apiFetch(
    endpoint +
      (queryParams ? "?" + new URLSearchParams(queryParams).toString() : ""),
    { ...options, method: "GET" }
  );
};

export const apiPost = (
  endpoint: string,
  body: any = {},
  options: any = {}
) => {
  return apiFetch(endpoint, {
    ...options,
    method: "POST",
    body,
  });
};

export const apiDelete = (endpoint: string, options: any = {}) => {
  return apiFetch(endpoint, {
    ...options,
    method: "DELETE",
  });
};

export const apiPatch = (
  endpoint: string,
  body: any = {},
  options: any = {}
) => {
  return apiFetch(endpoint, {
    ...options,
    method: "PATCH",
    body,
  });
};
