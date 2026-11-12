import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, httpUrl } from "@/lib/api";

interface Delivery {
  format: string;
  items: {
    placementId: string;
    targetUrl: string | null;
    showAdLabel?: boolean;
    content: { imageUrl: string | null; title: string };
  }[];
}

const rotationIntervalMs = 6_000;
const manualRotationDelayMs = 10_000;

export function Banner() {
  const { data } = useQuery({
    queryKey: ["public", "schedule-banner"],
    queryFn: ({ signal }) =>
      api<Delivery>("/ads/slots/web-schedule-banner", undefined, { signal }),
    staleTime: 300_000,
    retry: false,
  });
  const [activePlacementId, setActivePlacementId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [rotationEnabled] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [manualRotationDeadline, setManualRotationDeadline] = useState<number | null>(null);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [imageHovered, setImageHovered] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const isCarousel = data?.format === "carousel";
  const items = isCarousel
    ? data.items
    : data?.format === "banner"
      ? data.items.slice(0, 1)
      : [];
  const slides = items.flatMap((item) => {
    const image = httpUrl(item.content.imageUrl);
    return image && !failedImages.has(image) ? [{ item, image }] : [];
  });
  const index = Math.max(
    0,
    slides.findIndex(({ item }) => item.placementId === activePlacementId),
  );
  const slide = slides[index];
  const hasMultipleSlides = slides.length > 1;
  const next = slides[index + 1] ?? slides[0];
  const nextPlacementId = next?.item.placementId;

  useEffect(() => {
    if (!hasMultipleSlides || !rotationEnabled || imageHovered || !nextPlacementId) return;

    const delay = manualRotationDeadline === null
      ? rotationIntervalMs
      : Math.max(0, manualRotationDeadline - Date.now());
    const rotate = () => {
      if (document.visibilityState !== "visible" || document.activeElement === linkRef.current) {
        timer = window.setTimeout(rotate, rotationIntervalMs);
        return;
      }
      setManualRotationDeadline(null);
      setActivePlacementId(nextPlacementId);
    };
    let timer = window.setTimeout(rotate, delay);
    return () => window.clearTimeout(timer);
  }, [hasMultipleSlides, rotationEnabled, imageHovered, nextPlacementId, manualRotationDeadline]);

  if (!slide) return null;
  const { item, image } = slide;
  const previous = slides[index - 1] ?? slides[slides.length - 1];
  const target = httpUrl(item.targetUrl);

  function selectPlacement(placementId: string) {
    setManualRotationDeadline(Date.now() + manualRotationDelayMs);
    setActivePlacementId(placementId);
  }

  const media = (
    <>
      <img
        key={image}
        src={image}
        alt={item.content.title || "广告"}
        className="banner-image"
        data-loaded={hasMultipleSlides ? loadedImage === image : undefined}
        onLoad={() => setLoadedImage(image)}
        onError={() => {
          setFailedImages((failed) => new Set(failed).add(image));
          const remaining = [...slides.slice(index + 1), ...slides.slice(0, index)];
          const nextAvailable = remaining.find((candidate) => candidate.image !== image);
          setActivePlacementId(nextAvailable?.item.placementId ?? null);
        }}
        referrerPolicy="no-referrer"
      />
      {item.showAdLabel !== false && <span className="ad-label">广告</span>}
    </>
  );
  return (
    <aside
      className="banner"
      aria-label="广告"
      onPointerOver={(event) => {
        if (event.pointerType === "mouse" && event.target instanceof Element)
          setImageHovered(event.target.closest(".banner-surface") !== null);
      }}
      onPointerLeave={() => setImageHovered(false)}
    >
      {target ? (
        <a
          ref={linkRef}
          className="banner-surface"
          href={target}
          target="_blank"
          rel="noopener noreferrer"
        >
          {media}
        </a>
      ) : (
        <div className="banner-surface">{media}</div>
      )}
      {hasMultipleSlides && (
        <>
          <button
            className="banner-arrow banner-arrow-previous"
            type="button"
            aria-label="上一张广告"
            onClick={() => selectPlacement(previous.item.placementId)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            className="banner-arrow banner-arrow-next"
            type="button"
            aria-label="下一张广告"
            onClick={() => selectPlacement(next.item.placementId)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <div
            className="banner-indicators"
            role="group"
            aria-label={`第 ${index + 1} 张，共 ${slides.length} 张`}
          >
            {slides.map(({ item: placement }, position) => (
              <span
                key={placement.placementId}
                className="banner-dot"
                data-current={position === index}
                aria-hidden="true"
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
