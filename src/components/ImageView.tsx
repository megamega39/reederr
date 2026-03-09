interface ImageViewProps {
  src: string | null;
  alt: string;
}

export function ImageView({ src, alt }: ImageViewProps) {
  if (!src) {
    return (
      <div className="image-view image-view-loading">
        <span>読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="image-view">
      <img
        src={src}
        alt={alt}
        className="image-view-img"
        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
      />
    </div>
  );
}
