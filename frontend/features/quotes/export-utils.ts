/**
 * Customer Document Export & Native Download Utility.
 *
 * Streams binary artifacts (PDF / CSV) from the authoritative backend,
 * extracts SHA-256 fingerprint verification headers, sanitizes filenames,
 * and handles browser object URL lifecycle safely.
 */

export interface ExportDownloadResult {
  filename: string;
  sha256: string | null;
}

export async function downloadQuoteDocument(
  url: string,
  defaultFilename: string
): Promise<ExportDownloadResult> {
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
    },
    credentials: "include",
  });

  if (!resp.ok) {
    let errCode = "EXPORT_FAILED";
    let errMsg = "Failed to export quotation document.";
    try {
      const errJson = await resp.json();
      errCode = errJson.code || errCode;
      errMsg = errJson.message || errMsg;
    } catch {
      // Body was not JSON
    }
    const error = new Error(errMsg);
    (error as unknown as { code: string }).code = errCode;
    (error as unknown as { status: number }).status = resp.status;
    throw error;
  }

  const sha256 = resp.headers.get("X-Content-SHA256");
  const disposition = resp.headers.get("Content-Disposition");
  let filename = defaultFilename;

  if (disposition) {
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (filenameMatch && filenameMatch[1]) {
      // Prevent path traversal characters in downloaded filename
      filename = filenameMatch[1].replace(/[/\\?%*:|"<>]/g, "");
    }
  }

  const blob = await resp.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);

  return { filename, sha256 };
}
