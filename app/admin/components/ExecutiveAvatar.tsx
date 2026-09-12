"use client";

import { useState, useEffect, useCallback } from "react";
import { getInitials, getAvatarPalette, getVoterPhotoUrl } from "@/lib/voter-photo";
import { RotateCw } from "lucide-react";

interface ExecutiveAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  voterId?: string | null;
  region?: string | null;
  constituency?: string | null;
  size?: number;
  rounded?: "full" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
  reloadKey?: number | string;
  allowManualReload?: boolean;
}

// In-memory set of known dead/0-byte URLs so normal rendering doesn't re-choke the browser pool
const knownBrokenUrls = new Set<string>();

export function ExecutiveAvatar({
  imageUrl,
  name,
  voterId,
  region,
  constituency,
  size = 38,
  rounded = "full",
  className = "",
  style = {},
  reloadKey,
  allowManualReload = true,
}: ExecutiveAvatarProps) {
  // Determine effective photo URL (explicit imageUrl, or derive from region/constituency/voterId)
  const resolvedUrl =
    imageUrl && imageUrl.trim().length > 0
      ? imageUrl.trim()
      : getVoterPhotoUrl(region, constituency, voterId);

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadTimestamp, setReloadTimestamp] = useState<number | null>(null);

  // Manual reload function to renew the image state
  const handleReload = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (!resolvedUrl) return;

      // Clear from broken cache so it is allowed to re-fetch
      knownBrokenUrls.delete(resolvedUrl);

      // Renew state with fresh cache-busting timestamp
      setIsReloading(true);
      setImageError(false);
      setImageLoaded(false);
      setReloadTimestamp(Date.now());
    },
    [resolvedUrl]
  );

  // Reset error & reload state when URL or external reloadKey changes
  useEffect(() => {
    if (!resolvedUrl) {
      setImageError(false);
      setImageLoaded(false);
      setIsReloading(false);
      setReloadTimestamp(null);
      return;
    }

    if (reloadKey != null && reloadKey !== 0) {
      // Explicit parent reload requested
      knownBrokenUrls.delete(resolvedUrl);
      setIsReloading(true);
      setImageError(false);
      setImageLoaded(false);
      setReloadTimestamp(Date.now());
    } else if (knownBrokenUrls.has(resolvedUrl)) {
      setImageError(true);
      setImageLoaded(false);
      setIsReloading(false);
      setReloadTimestamp(null);
    } else {
      setImageError(false);
      setImageLoaded(false);
      setIsReloading(false);
      setReloadTimestamp(null);
    }
  }, [resolvedUrl, reloadKey]);

  const initials = getInitials(name);
  const palette = getAvatarPalette(name);

  const borderRadius =
    rounded === "full" ? "50%" : rounded === "lg" ? "10px" : "6px";
  const fontSize = Math.max(10, Math.round(size * 0.38));

  // Determine effective display URL with cache-busting parameter if reloaded
  const displayUrl = resolvedUrl
    ? reloadTimestamp
      ? `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}_r=${reloadTimestamp}`
      : resolvedUrl
    : null;

  const showImage = Boolean(displayUrl) && (!imageError || isReloading);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: palette.bg,
    color: palette.text,
    border: `1.5px solid ${palette.border}`,
    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25)",
    fontSize: `${fontSize}px`,
    fontWeight: 700,
    letterSpacing: "0.5px",
    userSelect: "none",
    flexShrink: 0,
    cursor: imageError && allowManualReload && resolvedUrl ? "pointer" : undefined,
    ...style,
  };

  return (
    <div
      className={`executive-avatar ${className}`}
      style={containerStyle}
      title={
        imageError && allowManualReload && resolvedUrl
          ? `${name ? `${name} - ` : ""}Photo failed to load. Click to reload.`
          : name || undefined
      }
      onClick={imageError && allowManualReload && resolvedUrl ? handleReload : undefined}
    >
      {/* Fallback Initials / Silhouette */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: imageLoaded && !isReloading ? 0 : 1,
          transition: "opacity 0.2s ease-in-out",
        }}
      >
        {initials}
      </span>

      {/* Voter Photo */}
      {showImage && (
        <img
          key={displayUrl}
          src={displayUrl!}
          alt={name ? `${name}'s photo` : "Voter photo"}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (resolvedUrl) {
              knownBrokenUrls.add(resolvedUrl);
            }
            setImageError(true);
            setIsReloading(false);
          }}
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false);
            setIsReloading(false);
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius,
            opacity: imageLoaded && !isReloading ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
          }}
        />
      )}

      {/* Reloading Spinner Overlay */}
      {isReloading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4,
          }}
        >
          <RotateCw
            size={Math.max(12, Math.round(size * 0.38))}
            color="#60a5fa"
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      )}

      {/* Interactive Reload Badge when image failed to load */}
      {imageError && Boolean(resolvedUrl) && allowManualReload && !isReloading && (
        <button
          type="button"
          onClick={handleReload}
          title="Click to reload photo"
          style={{
            position: "absolute",
            bottom: size >= 48 ? "3px" : "1px",
            right: size >= 48 ? "3px" : "1px",
            width: Math.max(15, Math.round(size * 0.36)),
            height: Math.max(15, Math.round(size * 0.36)),
            borderRadius: "50%",
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "#93c5fd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
            padding: 0,
            zIndex: 5,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#2563eb";
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.9)";
            e.currentTarget.style.color = "#93c5fd";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <RotateCw size={Math.max(8, Math.round(size * 0.2))} />
        </button>
      )}
    </div>
  );
}
