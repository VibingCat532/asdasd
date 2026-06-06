import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-10 text-center" data-testid="site-footer">
      <p className="text-sm text-zinc-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
        © 2026 HoodStories. Wszelkie prawa zastrzeżone.
      </p>
      <p
        className="mt-2 flex items-center justify-center gap-1.5 text-sm text-zinc-500"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        made with
        <Heart className="h-3.5 w-3.5 fill-[#00E5FF] text-[#00E5FF]" aria-hidden="true" />
        by <span className="text-[#00E5FF]">VibingCat</span>
      </p>
    </footer>
  );
}
