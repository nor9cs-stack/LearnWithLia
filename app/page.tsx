import { LoginPanel } from "@/components/auth/login-panel";
import { FloatingWords } from "@/components/auth/floating-words";
import { zh } from "@/lib/i18n/zh";
import { APP_CONFIG } from "@/lib/config";

export default function HomePage() {
  return (
    <main className="login-shell">
      <div className="login-glow" aria-hidden="true" />
      <FloatingWords />
      <section className="login-stage" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">L</div>
        <p className="eyebrow">{zh.home.eyebrow}</p>
        <h1 id="login-title">{APP_CONFIG.name}</h1>
        <p className="login-subtitle">{zh.home.subtitle}</p>
        <LoginPanel />
      </section>
      <p className="program-signature">{APP_CONFIG.footerBrand}</p>
    </main>
  );
}
