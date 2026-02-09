const API_BASE = "/api";

export async function downloadFile(path: string, token: string, fallbackName: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = (errorBody as { error?: string })?.error ?? "Export failed";
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fileName = getFileName(response.headers.get("Content-Disposition")) ?? fallbackName;
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function getFileName(header: string | null) {
  if (!header) {
    return null;
  }
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}
