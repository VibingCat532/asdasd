export default function VideoPlayer({ video, className = "", testId }) {
  if (!video?.src) {
    return null;
  }

  const frameClassName = `aspect-video w-full rounded-lg border border-white/10 bg-black ${className}`.trim();

  if (video.embedSrc) {
    return (
      <iframe
        src={video.embedSrc}
        title={video.title || "Filmik"}
        className={frameClassName}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        data-testid={testId}
      />
    );
  }

  return (
    <video
      src={video.src}
      controls
      className={frameClassName}
      data-testid={testId}
    />
  );
}
