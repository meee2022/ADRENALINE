/**
 * @file client/src/components/LocationPicker.tsx
 * @description منتقي موقع على خريطة Leaflet — اضغط أو اسحب الدبوس لتحديد الإحداثيات.
 *   يُستخدم في نموذج العميل لتحديد موقع التوصيل يدوياً.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DOHA: [number, number] = [25.2854, 51.531];

export function LocationPicker({
  lat,
  lng,
  onChange,
  height = 240,
}: {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pinIcon = L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#3cc4f0,#0E76AC);border:2px solid #fff;box-shadow:0 2px 8px rgba(14,42,74,.4)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const start: [number, number] = lat != null && lng != null ? [lat, lng] : DOHA;
    const map = L.map(elRef.current, { scrollWheelZoom: false }).setView(start, lat != null ? 15 : 11);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 }).addTo(map);

    const place = (la: number, ln: number) => {
      if (markerRef.current) markerRef.current.setLatLng([la, ln]);
      else {
        markerRef.current = L.marker([la, ln], { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current!.getLatLng();
          onChangeRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
        });
      }
    };
    if (lat != null && lng != null) place(lat, lng);

    map.on("click", (e: L.LeafletMouseEvent) => {
      place(e.latlng.lat, e.latlng.lng);
      onChangeRef.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });

    setTimeout(() => map.invalidateSize(), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تحديث الدبوس لو الإحداثيات اتغيّرت من الخارج (مثلاً بعد التحويل من العنوان)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
      });
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={elRef} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", zIndex: 0 }} />;
}

export default LocationPicker;
