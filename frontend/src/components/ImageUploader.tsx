"use client";

import { useRef, useState } from "react";
import { errorMessage, uploadImage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { imageOrPlaceholder } from "@/lib/format";
import { Spinner } from "./ui";

/**
 * Зураг байршуулагч: файл сонгоод backend руу upload хийж, буцаж ирсэн URL-ыг `urls`-д нэмнэ.
 * URL-ыг гараар бичих боломжийг ч хадгална (текст талбар).
 */
export default function ImageUploader({
  urls,
  onChange,
  multiple = true,
  label,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const { t } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadImage(file));
      }
      onChange(multiple ? [...urls, ...uploaded] : uploaded.slice(0, 1));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {label ? <span className="label">{label}</span> : null}

      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="relative">
            <img src={imageOrPlaceholder(url)} alt="" className="h-20 w-20 rounded-xl border border-line object-cover" />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-clay text-[11px] leading-none text-white"
              onClick={() => onChange(urls.filter((_, position) => position !== index))}
              aria-label={t("common.delete")}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-surface text-xs text-muted hover:bg-paper"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Spinner /> : `+ ${t("common.image")}`}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <p className="mt-1 text-xs text-muted">jpg · png · webp · gif (max 6MB)</p>
    </div>
  );
}
