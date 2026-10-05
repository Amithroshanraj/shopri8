import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Crosshair, List, Map as MapIcon, Search, X } from "lucide-react";
import { AppShell, EmptyState } from "@/components/layout/AppShell";
import { ShopCard } from "@/components/shop/Cards";
import { CATEGORY_BY_ID, DEMO_CENTER } from "@/data/demo";
import { distanceKm, formatDistance } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useActiveShops, useCategories } from "@/hooks/useCatalog";

const ShopMap = lazy(() => import("@/components/map/ShopMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Shops on the map — SHOPRi8" },
      { name: "description", content: "See neighbourhood shops around you on an open map." },
      { property: "og:title", content: "Shops on the map — SHOPRi8" },
      { property: "og:description", content: "See neighbourhood shops around you." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const shopsQuery = useActiveShops();
  const categoriesQuery = useCategories();
  const shops = shopsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationError(null);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access was denied. Please enable location services.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("Unable to access your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const filteredShops = shops.filter((shop) => {
    const matchesCategory = !selectedCategory || shop.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const displayedShops = filteredShops.slice(0, 4);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Around you</h1>
        <button
          onClick={handleMyLocation}
          className="press flex items-center gap-2 rounded-xl glass-1 px-3 py-2 text-xs font-medium text-soft-violet"
          aria-label="My Location"
        >
          <Crosshair className="h-4 w-4" />
          My Location
        </button>
      </div>

      {locationError && (
        <div className="mb-4 rounded-xl border border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {locationError}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl glass-2 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-soft-violet" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nearby shops or products"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="press shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Map/List Toggle */}
      <div className="mb-4 flex items-center gap-2 rounded-xl glass-1 p-1">
        <button
          onClick={() => setViewMode("map")}
          className={cn(
            "press flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            viewMode === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          <MapIcon className="h-4 w-4" />
          Map
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "press flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          <List className="h-4 w-4" />
          List
        </button>
      </div>

      {/* Category Filters */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "press shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium",
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "glass-1 text-muted-foreground",
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={cn(
              "press shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium",
              selectedCategory === c.id
                ? "bg-primary text-primary-foreground"
                : "glass-1 text-muted-foreground",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Map */}
      {viewMode === "map" && (
        <div className="mb-5 h-[55vh] overflow-hidden rounded-3xl glass-1">
          {mounted ? (
            <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
              <ShopMap
                shops={filteredShops.filter(
                  (shop) => shop.latitude !== undefined && shop.longitude !== undefined,
                )}
                userLocation={userLocation}
                onShopSelect={setSelectedShop}
              />
            </Suspense>
          ) : (
            <div className="h-full animate-pulse bg-muted" />
          )}
        </div>
      )}

      {shopsQuery.isError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {shopsQuery.error.message}
        </p>
      ) : null}

      {/* Shop List */}
      {displayedShops.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No nearby shops found"
          body="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid gap-3">
          {displayedShops.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      )}

      {/* Shop Preview Bottom Sheet */}
      {selectedShop &&
        (() => {
          const shop = shops.find((s) => s.id === selectedShop);
          if (!shop) return null;
          return (
            <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-2xl rounded-3xl glass-2 p-4">
                <button
                  onClick={() => setSelectedShop(null)}
                  className="press mb-3 mx-auto flex h-1 w-12 rounded-full bg-muted-foreground/30"
                  aria-label="Close"
                />
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <MapIcon className="h-6 w-6 text-soft-violet" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{shop.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_BY_ID[shop.category]?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{shop.address}</p>
                    {shop.latitude !== undefined && shop.longitude !== undefined ? (
                      <p className="mt-1 text-xs text-soft-violet">
                        {formatDistance(
                          distanceKm(DEMO_CENTER, {
                            latitude: shop.latitude,
                            longitude: shop.longitude,
                          }),
                        )}{" "}
                        away
                      </p>
                    ) : null}
                  </div>
                </div>
                <Link
                  to="/shops/$shopId"
                  params={{ shopId: selectedShop }}
                  onClick={() => setSelectedShop(null)}
                  className="press mt-4 block w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground text-center"
                >
                  View Shop
                </Link>
              </div>
            </div>
          );
        })()}
    </AppShell>
  );
}
