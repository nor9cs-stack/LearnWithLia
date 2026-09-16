import type { Metadata } from "next";
import { zh } from "@/lib/i18n/zh";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: zh.meta.defaultTitle,
    template: zh.meta.titleTemplate,
  },
  description: zh.meta.description,
  openGraph: {
    title: "LearnWithLia",
    description: zh.meta.socialDescription,
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: zh.meta.imageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LearnWithLia",
    description: zh.meta.socialDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
