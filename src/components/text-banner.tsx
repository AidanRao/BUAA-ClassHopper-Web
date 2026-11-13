import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { api, httpUrl } from "@/lib/api";

interface TextBannerDelivery {
  format: string;
  items: {
    targetUrl: string | null;
    showAdLabel?: boolean;
    content: {
      presentation?: string;
      title: string;
      buttonText?: string;
      backgroundColor?: string;
      textColor?: string;
    };
  }[];
}

const colors = new Set(["gray", "blue", "green", "amber", "red", "violet"]);

function radixColor(value: string | undefined, step: number) {
  return value && colors.has(value) ? `var(--${value}-${step})` : undefined;
}

export function TextBanner() {
  const { data, isError } = useQuery({
    queryKey: ["public", "app-text-banner"],
    queryFn: ({ signal }) =>
      api<TextBannerDelivery>("/ads/slots/web-schedule-text-banner", undefined, { signal }),
    staleTime: 300_000,
    retry: false,
  });

  const item = data?.items?.[0];
  if (isError || data?.format !== "banner" || item?.content?.presentation !== "text") return null;
  const title = item.content.title?.trim();
  if (!title) return null;

  const target = httpUrl(item.targetUrl);
  const buttonText = item.content.buttonText?.trim();
  const style = {
    "--text-banner-background": radixColor(item.content.backgroundColor, 2),
    "--text-banner-hover": radixColor(item.content.backgroundColor, 3),
    "--text-banner-color": radixColor(item.content.textColor, 12),
  } as CSSProperties;
  const body = (
    <>
      {item.showAdLabel !== false && <span className="text-banner-label">广告</span>}
      <span className="text-banner-copy">{title}</span>
    </>
  );

  return (
    <aside aria-label="文字广告">
      {target ? (
        <a className="text-banner-row" style={style} href={target} target="_blank" rel="noopener noreferrer">
          {body}
          {buttonText ? <span className="text-banner-action">{buttonText}</span>
            : <ChevronRight className="text-banner-arrow" size={16} aria-hidden="true" />}
        </a>
      ) : <div className="text-banner-row" style={style}>{body}</div>}
    </aside>
  );
}
