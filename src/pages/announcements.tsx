import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { api, httpUrl } from "@/lib/api";
import { today } from "@/lib/dates";
import type { Announcement, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Failure, LoadingRows, Message } from "@/components/feedback";
export function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["public", "announcements", page],
    queryFn: ({ signal }) =>
      api<Page<Announcement>>(
        `/announcement?page=${page}&pageSize=10`,
        undefined,
        { signal },
      ),
    staleTime: 60_000,
    retry: false,
  });
  if (query.isPending) return <LoadingRows />;
  if (query.error)
    return (
      <Failure
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (!query.data.items.length) return <Message title="暂无公告" />;
  const totalPages = Math.ceil(query.data.total / query.data.pageSize);
  return (
    <>
      <ul className="announcement-list">
        {query.data.items.map((item) => (
          <li key={item.id}>
            <Link
              to={`/app/announcements/${encodeURIComponent(item.id)}`}
              className="announcement-row"
            >
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-medium leading-7">
                  {item.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {item.isPinned && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Pin size={12} />
                      置顶
                    </span>
                  )}
                  <time>
                    {item.publishedAt ? today(new Date(item.publishedAt)) : ""}
                  </time>
                  {item.tags?.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              {httpUrl(item.coverUrl) && (
                <img
                  className="announcement-cover"
                  src={httpUrl(item.coverUrl)}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="公告分页">
          <Button
            size="icon"
            variant="ghost"
            disabled={page === 1}
            aria-label="上一页"
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="icon"
            variant="ghost"
            disabled={page >= totalPages}
            aria-label="下一页"
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </nav>
      )}
    </>
  );
}
export function AnnouncementDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["public", "announcement", id],
    queryFn: ({ signal }) =>
      api<Announcement>(`/announcement/${encodeURIComponent(id)}`, undefined, {
        signal,
      }),
    retry: false,
  });
  if (query.isPending) return <LoadingRows />;
  if (query.error)
    return (
      <Failure
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const item = query.data;
  return (
    <article className="detail-page">
      <h1 className="break-words text-lg font-semibold leading-7">
        {item.title}
      </h1>
      <time className="mt-3 block text-xs text-muted-foreground">
        {item.publishedAt ? today(new Date(item.publishedAt)) : ""}
      </time>
      <div className="markdown mt-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const target = httpUrl(href);
              return target ? (
                <a href={target} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              );
            },
            img: ({ src, alt }) =>
              httpUrl(typeof src === "string" ? src : undefined) ? (
                <img
                  src={httpUrl(String(src))}
                  alt={alt ?? ""}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null,
          }}
        >
          {item.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
