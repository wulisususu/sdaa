import type { Metadata } from "next";
import "./globals.css";
import "../styles/flow.css";
import "../styles/publishable.css";

export const metadata: Metadata = {
  title: "问得更好 · 知乎 AI 提问编译器",
  description: "把模糊需求，编译成值得回答的问题。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
