export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export function parseVideoFromOptions(options) {
  const video = options?.video;
  if (!video?.content) {
    return null;
  }

  const mime = video.mime_type || "video/mp4";
  const src = String(video.content).startsWith("data:")
    ? video.content
    : `data:${mime};base64,${video.content}`;

  return { ...video, src };
}

export function readVideoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        filename: file.name,
        size: file.size,
        mime_type: file.type || "video/mp4",
        content: base64,
      });
    };
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
