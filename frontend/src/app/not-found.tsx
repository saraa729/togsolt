import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page max-w-md py-24 text-center">
      <p className="text-6xl">🧶</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Хуудас олдсонгүй / Page not found</h1>
      <p className="muted mt-2">
        Хайсан хуудас байхгүй эсвэл устсан байна. / The page you are looking for does not exist.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn-primary">
          Нүүр / Home
        </Link>
        <Link href="/products" className="btn-secondary">
          Бүтээлүүд / Crafts
        </Link>
      </div>
    </div>
  );
}
