import Image, { type ImageProps } from "next/image";

/* One component decides how a content photo is served, so no carousel has to
   know where the photo came from.

   next/image cannot serve R2: /_next/image fetches only through the ASSETS
   binding and rejects anything that binding does not hold. Seeded photos live
   in public/media and go through the optimizer (measured 635 KB → 40 KB at
   640w); uploaded ones live in R2 behind /img/, so they are served as-is with
   native lazy loading. The upload script already resizes to 1600px, which is
   what keeps "as-is" from meaning "7 MB". */
export default function Img({
  src,
  alt,
  fill,
  sizes,
  priority,
  className,
  style,
  ...rest
}: ImageProps & { src: string }) {
  if (src.startsWith("/img/")) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
        /* Reproduces what next/image does for `fill`, so every existing rule in
           globals.css keeps working and no carousel's CSS changes. */
        style={
          fill
            ? {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...style,
              }
            : style
        }
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      style={style}
      {...rest}
    />
  );
}
