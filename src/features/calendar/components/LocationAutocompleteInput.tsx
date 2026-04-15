"use client";

import { useEffect, useRef } from "react";
import { MapPin, ExternalLink } from "lucide-react";

const MAPS_SCRIPT_ID = "google-maps-places-js";

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const tryResolve = () => {
      if (window.google?.maps?.places) {
        resolve();
        return true;
      }
      return false;
    };

    if (document.getElementById(MAPS_SCRIPT_ID)) {
      if (tryResolve()) return;
      const iv = window.setInterval(() => {
        if (tryResolve()) window.clearInterval(iv);
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(iv);
        if (!window.google?.maps?.places) {
          reject(new Error("Google Maps Places недоступний"));
        }
      }, 20000);
      return;
    }

    const s = document.createElement("script");
    s.id = MAPS_SCRIPT_ID;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=uk`;
    s.onload = () => {
      window.setTimeout(() => {
        if (!tryResolve()) {
          reject(new Error("Places library не завантажилась"));
        }
      }, 0);
    };
    s.onerror = () => reject(new Error("Не вдалося завантажити скрипт Google Maps"));
    document.head.appendChild(s);
  });

  return mapsScriptPromise;
}

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Локація з підказками Google Places (потрібен NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
 * Без ключа — звичайне поле + посилання «На карті».
 */
export function LocationAutocompleteInput({
  id = "event-location",
  value,
  onChange,
  disabled,
  placeholder = "Почніть вводити адресу…",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);

  const apiKey =
    typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "string"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim()
      : "";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    let cancelled = false;
    let ac: google.maps.places.Autocomplete | null = null;

    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "name", "geometry"],
          types: ["establishment", "geocode"],
        });
        acRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac?.getPlace();
          const addr =
            place?.formatted_address?.trim() ||
            place?.name?.trim() ||
            "";
          if (addr) onChangeRef.current(addr);
        });
      })
      .catch(() => {
        /* ключ невірний або мережа — лишаємо звичайний input */
      });

    return () => {
      cancelled = true;
      if (ac) {
        google.maps.event.clearInstanceListeners(ac);
      }
      acRef.current = null;
    };
  }, [apiKey]);

  const mapsSearchHref =
    value.trim().length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim())}`
      : "https://www.google.com/maps";

  return (
    <div className="space-y-1">
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {apiKey ? (
          <p className="text-[10px] text-slate-500">
            Підказки з Google Maps (Places)
          </p>
        ) : (
          <p className="text-[10px] text-slate-500">
            Додайте{" "}
            <code className="rounded bg-slate-100 px-0.5 text-[9px]">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            у <code className="rounded bg-slate-100 px-0.5 text-[9px]">.env.local</code>{" "}
            для автодоповнення адрес.
          </p>
        )}
        <a
          href={mapsSearchHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 hover:text-sky-900"
        >
          <ExternalLink className="h-3 w-3" />
          Відкрити в Google Maps
        </a>
      </div>
    </div>
  );
}
