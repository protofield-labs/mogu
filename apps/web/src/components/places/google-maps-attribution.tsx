export function GoogleMapsAttribution({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-[0.65rem] text-muted-foreground"}>
      Google Maps
    </p>
  );
}
