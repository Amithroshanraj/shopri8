import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCatalog";

export function CategoryCarousel() {
  const { data: categories = [] } = useCategories();
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Duplicate categories for seamless looping (3 sets for smooth infinite scroll)
  const duplicatedCategories = [...categories, ...categories, ...categories];

  // Auto-scroll logic
  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationFrameId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      scrollPosition += scrollSpeed;

      // Calculate when to reset (when we've scrolled through one full set)
      const singleSetWidth = scrollContainer.scrollWidth / 3;

      if (scrollPosition >= singleSetWidth) {
        scrollPosition = 0;
      }

      scrollContainer.scrollLeft = scrollPosition;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [prefersReducedMotion, isPaused]);

  // Manual scroll handling
  const handleScroll = () => {
    if (!scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    const singleSetWidth = scrollContainer.scrollWidth / 3;

    // If we've scrolled past the first set, reset to beginning
    if (scrollContainer.scrollLeft >= singleSetWidth) {
      scrollContainer.scrollLeft = scrollContainer.scrollLeft % singleSetWidth;
    }
  };

  return (
    <div className="relative">
      {/* Left fade */}
      <div className="absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent pointer-events-none" />

      {/* Right fade */}
      <div className="absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      <div
        ref={scrollRef}
        className={cn(
          "no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 scroll-smooth",
          prefersReducedMotion && "overflow-x-auto",
        )}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onScroll={handleScroll}
      >
        {duplicatedCategories.map((c, index) => (
          <Link
            key={`${c.id}-${index}`}
            to="/search"
            search={{ category: c.id }}
            className="press flex w-20 shrink-0 flex-col items-center gap-2"
          >
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl glass-1">
              <img
                src={c.image}
                alt={`${c.name} category`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <span className="line-clamp-2 text-center text-[0.7rem] text-muted-foreground">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
