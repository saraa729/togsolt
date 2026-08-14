"use client";

import { usePathname } from "next/navigation";
import BackButton from "./BackButton";
import Footer from "./Footer";
import Header from "./Header";

/**
 * Танилцуулга хуудас (`/`) өөрийн nav, хөлтэй тул ерөнхий толгой/хөлийг харуулахгүй.
 * Auth хуудсууд өөрийн төвлөрсөн дэлгэцтэй тул navbar/footer-гүй харагдана.
 * Бусад бүх хуудсанд — нэвтэрсэн нүүр (`/home`) орно — стандарт бүрхүүл үйлчилнэ.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const bareRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

  if (bareRoutes.includes(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* Хуудсууд өөрсдөө `py-10` авдаг тул энэ мөр зөвхөн дээд зайг эзэлнэ. */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <BackButton />
      </div>
      <main className="flex-1 pb-16">{children}</main>
      <Footer />
    </div>
  );
}
