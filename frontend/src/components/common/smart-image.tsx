import * as React from "react";

import { cn } from "@/lib/utils";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  /** Applied to the wrapper element the image fills. */
  wrapperClassName?: string;
}

/**
 * Backdrop rendered beneath every image: a trouser glyph on the muted surface.
 *
 * It is inline SVG rather than an <img> so it picks up the light/dark theme
 * through `currentColor`. Because it is always present, a slow or remote image
 * shows a branded placeholder instead of an empty box.
 */
function ImageBackdrop() {
  return (
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-muted">
      <svg
        viewBox="0 0 100 125"
        className="h-[38%] w-[38%] text-primary/25"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M28 12h44l6 96H60L50 56 40 108H22z" />
        <path d="M28 12v10h44V12" />
      </svg>
    </span>
  );
}

/**
 * An <img> that never shows a broken icon and never leaves a blank hole: the
 * backdrop is visible immediately, and the photograph fades in once it loads.
 */
export function SmartImage({ src, alt, className, wrapperClassName, ...props }: SmartImageProps) {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");
  const imageRef = React.useRef<HTMLImageElement>(null);

  // A new source starts a fresh load cycle.
  React.useEffect(() => {
    setStatus("loading");
  }, [src]);

  // An image restored from the HTTP cache can be complete before the load
  // handler is attached, which would leave it stuck at opacity-0.
  React.useEffect(() => {
    const image = imageRef.current;
    if (image?.complete) {
      setStatus(image.naturalWidth > 0 ? "loaded" : "error");
    }
  }, [src]);

  const showImage = Boolean(src) && status !== "error";

  return (
    <span className={cn("relative block overflow-hidden bg-muted", wrapperClassName)}>
      <ImageBackdrop />
      {showImage && (
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "img-outline relative size-full object-cover transition-opacity duration-500",
            status === "loaded" ? "opacity-100" : "opacity-0",
            className,
          )}
          {...props}
        />
      )}
    </span>
  );
}
