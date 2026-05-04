/**
 * @file client/src/components/public/HeroCarousel.tsx
 * @description Hero carousel slider with swipe support - Modern rounded card design
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
    <div className="relative w-full bg-gradient-to-br from-[#0F1516] via-[#47759C] to-[#3CC4F0] pt-6 pb-16 md:pt-10 md:pb-24" dir={isRtl ? "rtl" : "ltr"}>
      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 z-10">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl shadow-xl">
          {/* Carousel */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {banners.map((banner, index) => (
                <div
                  key={banner._id}
                  className="relative flex-[0_0_100%] min-w-0 h-[280px] sm:h-[300px] md:h-[340px] lg:h-[380px]"
                >
                  {/* Background Image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${banner.imageUrl})`,
                    }}
                  >
                    {/* Softer gradient overlay - Responsive */}
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-[#0F1516]/90 via-[#0F1516]/60 md:via-[#0F1516]/40 to-transparent pointer-events-none" />
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute inset-0 z-10 flex flex-col justify-end md:justify-center p-5 sm:p-8 md:p-16 lg:p-20">
                    <div className="w-full sm:max-w-md md:max-w-xl text-start">
                      {/* Logo - يظهر فقط إذا كان موجود في Settings */}
                      {settings?.heroLogoUrl && (
                        <div className="mb-5 flex justify-start">
                          <img
                            src={settings.heroLogoUrl}
                            alt="Logo"
                            className="h-10 md:h-14 object-contain drop-shadow-lg"
                          />
                        </div>
                      )}

                      {/* Title */}
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-3 leading-snug md:leading-tight drop-shadow-md">
                        {isRtl ? banner.titleAr : banner.titleEn || banner.titleAr}
                      </h1>

                      {/* Subtitle */}
                      {(banner.subtitleAr || banner.subtitleEn) && (
                        <p className="text-xs sm:text-sm md:text-lg text-white/90 mb-4 md:mb-6 drop-shadow-sm line-clamp-2 md:line-clamp-none">
                          {isRtl ? banner.subtitleAr : banner.subtitleEn || banner.subtitleAr}
                        </p>
                      )}

                      {/* CTA Buttons */}
                      <div className="flex flex-row items-center justify-start gap-2 md:gap-3 mt-auto md:mt-0">
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
                          className="h-9 sm:h-10 md:h-12 px-4 sm:px-6 md:px-8 rounded-full bg-[#3CC4F0] hover:bg-[#2ab3de] text-white font-bold text-xs sm:text-sm md:text-base shadow-lg shadow-[#3CC4F0]/30 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] flex-1 sm:flex-none"
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
                          className="h-9 sm:h-10 md:h-12 px-4 sm:px-6 md:px-8 rounded-full border border-white/70 md:border-2 text-white hover:bg-white/15 font-bold text-xs sm:text-sm md:text-base backdrop-blur-sm transition-all duration-300 hover:border-white flex-1 sm:flex-none"
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
                "absolute top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20 transition-all duration-300",
                isRtl ? "right-3" : "left-3"
              )}
            >
              {isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
            <Button
              onClick={scrollNext}
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20 transition-all duration-300",
                isRtl ? "left-3" : "right-3"
              )}
            >
              {isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
          </div>

          {/* Dots Indicators */}
          <div className="absolute bottom-4 left-0 right-0 z-20">
            <div className="flex items-center justify-center gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollTo(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    selectedIndex === index
                      ? "w-7 bg-[#3CC4F0] shadow-md shadow-[#3CC4F0]/40"
                      : "w-2 bg-white/50 hover:bg-white/70"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-12 md:h-20" preserveAspectRatio="none">
          <path
            fill="#F9FAFB"
            fillOpacity="1"
            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          />
        </svg>
      </div>
    </div>
  );
}
