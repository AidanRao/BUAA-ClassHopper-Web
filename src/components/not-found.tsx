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
      <img
        className="not-found-image"
        src="/images/not-found-cat.gif"
        alt="404 小猫"
        width={150}
        height={133}
      />
      <h1 className="text-lg font-medium">{title}</h1>
      <Button className="mt-5" asChild>
        <Link to={to}>{action}</Link>
      </Button>
    </section>
  );
}
