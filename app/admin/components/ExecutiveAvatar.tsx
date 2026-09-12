"use client";

import { useState, useEffect } from "react";
import { getInitials, getAvatarPalette, getVoterPhotoUrl } from "@/lib/voter-photo";

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
}

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
}: ExecutiveAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Determine effective photo URL (explicit imageUrl, or derive from region/constituency/voterId)
  const resolvedUrl =
    imageUrl && imageUrl.trim().length > 0
      ? imageUrl.trim()
      : getVoterPhotoUrl(region, constituency, voterId);

  // Reset error state if the URL changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setRetryAttempt(0);
  }, [resolvedUrl]);

  const initials = getInitials(name);
  const palette = getAvatarPalette(name);

  const borderRadius =
    rounded === "full" ? "50%" : rounded === "lg" ? "10px" : "6px";
  const fontSize = Math.max(10, Math.round(size * 0.38));

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
    ...style,
  };

  const showImage = Boolean(resolvedUrl) && !imageError;
  const displayUrl =
    resolvedUrl && retryAttempt > 0
      ? `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}retry=${retryAttempt}`
      : resolvedUrl;

  return (
    <div
      className={`executive-avatar ${className}`}
      style={containerStyle}
      title={name || undefined}
    >
      {/* Fallback Initials / Silhouette */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: imageLoaded ? 0 : 1,
          transition: "opacity 0.2s ease-in-out",
        }}
      >
        {initials}
      </span>

      {/* Voter Photo */}
      {showImage && (
        <img
          src={displayUrl!}
          alt={name ? `${name}'s photo` : "Voter photo"}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (retryAttempt < 1) {
              setRetryAttempt(1);
              return;
            }
            setImageError(true);
          }}
          onLoad={() => setImageLoaded(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius,
            opacity: imageLoaded ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
          }}
        />
      )}
    </div>
  );
}
