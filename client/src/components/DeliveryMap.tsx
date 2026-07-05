/**
 * @file client/src/components/DeliveryMap.tsx
 * @description خريطة توصيل بـ Leaflet + OpenStreetMap (مجاني، بدون مفتاح).
 *   تعرض نقطة انطلاق المطعم + محطات العملاء مرقّمة بالترتيب، مع نافذة لكل محطة.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  order?: number;
};

const DOHA: [number, number] = [25.2854, 51.531];

export function DeliveryMap({
  stops,
  origin,
  height = 360,
}: {
  stops: MapStop[];
  origin?: { lat: number; lng: number } | null;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(elRef.current, { scrollWheelZoom: false }).setView(DOHA, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }
    const map = mapRef.current!;
    const layer = layerRef.current!;
    layer.clearLayers();

    const pts: [number, number][] = [];

    // نقطة انطلاق المطعم
    if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      const originIcon = L.divIcon({
        className: "",
        html: `<div style="width:30px;height:30px;border-radius:50%;background:#0f1516;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">★</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(layer).bindPopup("المطعم (نقطة الانطلاق)");
      pts.push([origin.lat, origin.lng]);
    }

    // محطات العملاء المرقّمة
    stops.forEach((s, i) => {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
      const num = s.order ?? i + 1;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#3cc4f0,#0E76AC);border:2px solid #fff;box-shadow:0 2px 8px rgba(14,42,74,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-weight:900;font-size:12px">${num}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 26],
      });
      const nav = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`;
      const popup = `<div style="font-family:Cairo,sans-serif;min-width:150px">
        <div style="font-weight:800;color:#0f1516">${num}. ${s.name || ""}</div>
        ${s.address ? `<div style="font-size:12px;color:#47759c;margin-top:2px">${s.address}</div>` : ""}
        ${s.phone ? `<a href="tel:${s.phone}" style="font-size:12px;color:#0E76AC;font-weight:700">${s.phone}</a><br/>` : ""}
        <a href="${nav}" target="_blank" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:800;color:#fff;background:#0E76AC;padding:4px 10px;border-radius:8px;text-decoration:none">التوجّه ←</a>
      </div>`;
      L.marker([s.lat, s.lng], { icon }).addTo(layer).bindPopup(popup);
      pts.push([s.lat, s.lng]);
    });

    if (pts.length === 1) {
      map.setView(pts[0], 14);
    } else if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2));
    }
    // إصلاح حجم الخريطة داخل الحاويات المخفية/المتغيّرة
    setTimeout(() => map.invalidateSize(), 100);
  }, [stops, origin]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={elRef} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden", zIndex: 0 }} />;
}

export default DeliveryMap;
