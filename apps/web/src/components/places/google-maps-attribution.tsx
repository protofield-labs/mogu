export function GoogleMapsAttribution({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-caption text-muted-foreground"}>
      Google Maps
    </p>
  );
}
