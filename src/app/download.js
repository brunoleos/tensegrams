// Trigger a browser download of in-memory text as a file. This is the
// single place that builds an object URL and clicks a synthetic <a> — the
// debug pack and the DSL/config export both funnel through here so there's
// one download path to reason about.

export function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Free the blob after the download starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Filesystem-safe timestamp for generated filenames: ISO 8601 with the
// `:` and `.` (illegal in Windows filenames) swapped for `-`.
export function fileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
