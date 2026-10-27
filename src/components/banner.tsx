import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, httpUrl } from "@/lib/api";
interface Delivery {
  format: string;
  items: {
    placementId: string;
    targetUrl: string | null;
    content: { imageUrl: string | null; title: string };
  }[];
}
export function Banner() {
  const query = useQuery({
    queryKey: ["public", "schedule-banner"],
    queryFn: ({ signal }) =>
      api<Delivery>("/ads/slots/web-schedule-banner", undefined, { signal }),
    staleTime: 300_000,
    retry: false,
  });
  const item =
    query.data?.format === "banner" ? query.data.items[0] : undefined;
  const [failed, setFailed] = useState<string | null>(null);
  const image = httpUrl(item?.content.imageUrl);
  if (!item || !image || failed === image) return null;
  const media = (
    <img
      src={image}
      alt={item.content.title || "广告"}
      className="banner-image"
      onError={() => setFailed(image)}
      referrerPolicy="no-referrer"
    />
  );
  const target = httpUrl(item.targetUrl);
  return (
    <aside className="banner" aria-label="广告">
      {target ? (
        <a href={target} target="_blank" rel="noopener noreferrer">
          {media}
        </a>
      ) : (
        media
      )}
      <span className="ad-label">广告</span>
    </aside>
  );
}
