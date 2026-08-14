"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Уншигдах жинхэнэ QR код.
 *
 * `qrcode`-ийн синхрон `create()`-ээр модулийн матриц авч, SVG-г өөрсдөө
 * зурна — ингэснээр ачаалах төлөв хэрэггүй, өнгө нь сайтын палитрыг дагана.
 * Утга нь буруу байвал зурахын оронд `null` буцаана (эвдэрсэн QR харуулахгүй).
 */
export default function QrCode({
  value,
  size = 224,
  className = "",
  label,
}: {
  value: string;
  /** Талбарын пикселийн хэмжээ. QR нь квадрат. */
  size?: number;
  className?: string;
  /** Дэлгэц уншигчид зориулсан тайлбар. */
  label?: string;
}) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try {
      const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
      return { count: modules.size, data: modules.data as unknown as Uint8Array };
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  // Захын цагаан хүрээ (quiet zone) — уншигч QR-ыг таних стандарт шаардлага.
  const quietZone = 2;
  const span = matrix.count + quietZone * 2;

  const cells: string[] = [];
  for (let row = 0; row < matrix.count; row += 1) {
    for (let column = 0; column < matrix.count; column += 1) {
      if (!matrix.data[row * matrix.count + column]) continue;
      cells.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label || value}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={cells.join("")} fill="var(--color-night)" />
    </svg>
  );
}
