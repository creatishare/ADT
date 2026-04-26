import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Designer V2",
  description: "基于 Next.js 与 Vercel AI SDK 的多智能体关卡设计系统，支持对话编排、文档生成、验证与工件展示。",
  applicationName: "Agent Designer V2",
  keywords: ["AI", "关卡设计", "多智能体", "Next.js", "Vercel AI SDK", "Artifacts"],
  openGraph: {
    title: "Agent Designer V2",
    description: "多智能体关卡设计 Web 应用，支持 Chat + Artifacts 双栏工作流。",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
