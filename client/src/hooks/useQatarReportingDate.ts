import { useEffect, useState } from "react";
import { qatarReportingDate } from "@/lib/subscriptionReporting";

/** Refresh a read-only metric across Qatar midnight, including after backgrounding. */
export function useQatarReportingDate() {
  const [today, setToday] = useState(() => qatarReportingDate());
  useEffect(() => {
    const refresh = () => setToday(qatarReportingDate());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
