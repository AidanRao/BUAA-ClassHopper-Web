import { ArrowUpRight, Download, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./home.css";

const androidDownloadUrl =
  "https://app-releases.aidanrao.top/buaa-classhopper/android/releases/1.5.6/app-release.apk";

// Keep source dimensions so supplied screenshots are displayed without cropping.
const homeImages = {
  hero: {
    src: "/images/android-home.png",
    alt: "BUAA ClassHopper Android 首页与当日课程",
    width: 839,
    height: 1642,
  },
  schedule: { src: "", alt: "按日期查看课程安排", width: 1200, height: 900 },
  reservation: {
    src: "/images/android-sign-in-reservation.png",
    alt: "Android 应用的预约签到界面，可选择自动签到或仅提醒我",
    width: 704,
    height: 1218,
  },
};

function ProductImage({ slot }: { slot: keyof typeof homeImages }) {
  const { src, alt, width, height } = homeImages[slot];
  return (
    <div
      className={`home-image home-image--${slot}${src ? " home-image--filled" : ""}`}
      style={src ? { aspectRatio: `${width} / ${height}` } : undefined}
      aria-hidden={src ? undefined : true}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={slot === "hero" ? "eager" : "lazy"}
        />
      )}
    </div>
  );
}

function WebLink({ className = "" }: { className?: string }) {
  return (
    <Button asChild className={`home-button ${className}`}>
      <a href="/app" data-analytics-id="open-web">
        进入网页版 <ArrowUpRight size={16} aria-hidden="true" />
      </a>
    </Button>
  );
}

function AndroidLink() {
  return (
    <Button asChild variant="outline" className="home-button home-button--secondary">
      <a href={androidDownloadUrl} data-analytics-id="download-android">
        <Download size={16} aria-hidden="true" /> 下载 Android 版
      </a>
    </Button>
  );
}

export function HomePage() {
  return (
    <div className="classhopper-home">
      <a className="home-skip-link" href="#home-main">跳到正文</a>
      <header className="home-header home-container">
        <a href="/" className="home-brand" aria-label="BUAA ClassHopper 首页">
          <img src="/icons/buaa-classhopper.jpeg" width="36" height="36" alt="" />
          <span>BUAA ClassHopper</span>
        </a>
        <nav className="home-navigation" aria-label="首页导航">
          <a className="home-section-link" href="#features">功能</a>
          <a className="home-section-link" href="#download">下载</a>
          <WebLink className="home-header-button" />
        </nav>
      </header>

      <main id="home-main">
        <section className="home-hero home-container" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title">课程安排，<br />随时掌握。</h1>
            <p>查看课表、课程详情与签到状态。</p>
            <div className="home-actions">
              <WebLink />
              <AndroidLink />
            </div>
          </div>
          <ProductImage slot="hero" />
        </section>

        <div id="features" className="home-features home-container">
          <section className="home-feature" aria-labelledby="home-schedule-title">
            <ProductImage slot="schedule" />
            <div className="home-feature-copy">
              <h2 id="home-schedule-title">课程安排，一目了然</h2>
              <p>按日期查看当天课程，<br />上课时间与教室，清晰呈现。</p>
            </div>
          </section>
          <section className="home-feature home-feature--reverse" aria-labelledby="home-reservation-title">
            <ProductImage slot="reservation" />
            <div className="home-feature-copy">
              <h2 id="home-reservation-title">签到预约，提前安排</h2>
              <p>Android 应用支持预约签到，<br />可选择自动签到或到点提醒。</p>
            </div>
          </section>
        </div>

        <section id="download" className="home-download" aria-labelledby="home-download-title">
          <div className="home-container">
            <h2 id="home-download-title">选择你的使用方式</h2>
            <div className="home-platforms">
              <div className="home-platform">
                <Monitor size={24} strokeWidth={1.5} aria-hidden="true" />
                <h3>网页版</h3>
                <p>打开浏览器，即可使用。</p>
                <WebLink />
              </div>
              <div className="home-platform">
                <Smartphone size={24} strokeWidth={1.5} aria-hidden="true" />
                <h3>Android 版</h3>
                <p>使用 Android 应用，体验更完整的功能。</p>
                <AndroidLink />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer home-container">
        <span className="home-footer-brand">BUAA ClassHopper</span>
        <a href="/privacy-and-terms">用户协议与隐私政策</a>
      </footer>
    </div>
  );
}
