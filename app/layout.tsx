import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PRESS — 짧은 움직임, 오래 남는 감각.",
  description:
    "손끝에서 시작되는 작은 세계. 기계식 스위치의 구조를 탐험하는 인터랙티브 컨셉 프로젝트.",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
