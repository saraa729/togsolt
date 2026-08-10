"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Header from "./Header";

/**
 * Танилцуулга хуудас (`/`) өөрийн nav, хөлтэй тул ерөнхий толгой/хөлийг харуулахгүй.
 * Бусад бүх хуудсанд — нэвтэрсэн нүүр (`/home`) орно — стандарт бүрхүүл үйлчилнэ.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  if (pathname === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-16">{children}</main>
      <Footer />
    </div>
  );
}
