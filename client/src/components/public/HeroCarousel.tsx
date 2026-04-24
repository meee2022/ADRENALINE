/**
 * @file client/src/components/public/HeroCarousel.tsx
 * @description Hero carousel slider with swipe support
 */
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Banner {
  _id: string;
  titleAr: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  imageUrl: string;
}

interface HeroCarouselProps {
  banners: Banner[];
  isRtl?: boolean;
  settings?: any; // Restaurant settings from Convex
}

export function HeroCarousel({ banners, isRtl = true, settings }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    direction: isRtl ? "rtl" : "ltr",
    align: "center",
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full overflow-hidden bg-[#0F1516]" dir={isRtl ? "rtl" : "ltr"}>
      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner, index) => (
            <div
              key={banner._id}
              className="relative flex-[0_0_100%] min-w-0"
              style={{ minHeight: "500px" }}
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${banner.imageUrl})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1516] via-[#0F1516]/50 to-transparent pointer-events-none" />
              </div>

              {/* Content Overlay */}
              <div className="absolute inset-0 z-10 flex items-center justify-end p-8 md:p-24">
                <div className="max-w-2xl text-start">
                  {/* Logo - يظهر فقط إذا كان موجود في Settings */}
                  {settings?.heroLogoUrl && (
                    <div className="mb-8 flex justify-start">
                      <img
                        src={settings.heroLogoUrl}
                        alt="Logo"
                        className="h-16 object-contain"
                      />
                    </div>
                  )}

                  {/* Title */}
                  <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
                    {isRtl ? banner.titleAr : banner.titleEn || banner.titleAr}
                  </h1>

                  {/* Subtitle */}
                  {(banner.subtitleAr || banner.subtitleEn) && (
                    <p className="text-lg md:text-2xl text-[#BCBEBF] mb-8">
                      {isRtl ? banner.subtitleAr : banner.subtitleEn || banner.subtitleAr}
                    </p>
                  )}

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row items-start justify-start gap-4">
                    <Button
                      onClick={() => {
                        const link = settings?.heroCta1Link || "#plans-section";
                        if (link.startsWith("#")) {
                          const section = document.getElementById(link.slice(1));
                          section?.scrollIntoView({ behavior: "smooth" });
                        } else {
                          window.location.href = link;
                        }
                      }}
                      className="h-14 px-8 rounded-full bg-[#3CC4F0] hover:bg-[#3CC4F0]/90 text-white font-bold text-lg shadow-lg"
                    >
                      {isRtl 
                        ? (settings?.heroCta1TextAr || "اشترك الآن") 
                        : (settings?.heroCta1TextEn || "Subscribe Now")
                      }
                    </Button>
                    <Button
                      onClick={() => {
                        const link = settings?.heroCta2Link || "/public/menu";
                        window.location.href = link;
                      }}
                      variant="outline"
                      className="h-14 px-8 rounded-full border-2 border-white text-white hover:bg-white/10 font-bold text-lg"
                    >
                      {isRtl 
                        ? (settings?.heroCta2TextAr || "المنيو") 
                        : (settings?.heroCta2TextEn || "Menu")
                      }
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Desktop */}
      <div className="hidden md:block">
        <Button
          onClick={scrollPrev}
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white",
            isRtl ? "right-4" : "left-4"
          )}
        >
          {isRtl ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
        </Button>
        <Button
          onClick={scrollNext}
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white",
            isRtl ? "left-4" : "right-4"
          )}
        >
          {isRtl ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
        </Button>
      </div>

      {/* Dots Indicators */}
      <div className="absolute bottom-8 left-0 right-0 z-20">
        <div className="flex items-center justify-center gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                selectedIndex === index
                  ? "w-8 bg-[#3CC4F0]"
                  : "w-2 bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
