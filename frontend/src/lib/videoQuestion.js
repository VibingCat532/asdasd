export function parseVideoFromOptions(options) {
  const video = options?.video;
  if (!video) {
    return null;
  }

  const url = String(video.url || "").trim();
  if (url) {
    const youtubeEmbedSrc = getYouTubeEmbedSrc(url);
    return {
      ...video,
      url,
      src: youtubeEmbedSrc || url,
      embedSrc: youtubeEmbedSrc,
      sourceType: youtubeEmbedSrc ? "embed" : "video",
    };
  }

  if (!video.content) {
    return null;
  }

  const mime = video.mime_type || "video/mp4";
  const src = String(video.content).startsWith("data:")
    ? video.content
    : `data:${mime};base64,${video.content}`;

  return { ...video, src, sourceType: "video" };
}

export function getYouTubeEmbedSrc(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId) return `https://www.youtube.com/embed/${watchId}`;

      const parts = url.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) {
        return `https://www.youtube.com/embed/${parts[1]}`;
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
