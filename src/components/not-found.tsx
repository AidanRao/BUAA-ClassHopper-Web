import { Link } from "react-router";
import { Button } from "./ui/button";

export function NotFound({
  title = "页面不存在",
  to = "/app",
  action = "进入网页版",
}: {
  title?: string;
  to?: string;
  action?: string;
}) {
  return (
    <section className="not-found">
      <video
        className="not-found-image"
        src="/videos/not-found.mp4"
        width={720}
        height={720}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        aria-hidden="true"
      />
      <h1 className="text-lg font-medium">{title}</h1>
      <Button className="mt-5" asChild>
        <Link to={to}>{action}</Link>
      </Button>
    </section>
  );
}
