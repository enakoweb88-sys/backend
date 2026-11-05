export function previewMimeType(name: string, data: Buffer): string {
  if (data.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString()))
    return "image/gif";
  if (
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (/\.(txt|csv|md|log|json)$/i.test(name) && !data.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data);
      return "text/plain;charset=utf-8";
    } catch {
      /* Binary file. */
    }
  }
  return "application/octet-stream";
}

export function attachmentDisposition(name: string) {
  const safe = name.replace(/[\r\n"\\]/g, "_");
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(safe).replace(
    /['()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16),
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
