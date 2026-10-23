const RULES_URL = "https://docs.google.com/document/d/1d6cqpNGjw46U00RSAFRSnhg0yJy4mG7605eh3qtkCIk/edit?usp=sharing";
const DISCORD_URL = "https://discord.gg/hspl";

export default function Footer() {
  return (
    <footer className="max-w-[1240px] w-full mx-auto px-4 sm:px-8 pt-14 pb-12 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 sm:gap-6" data-testid="site-footer">
      <div className="flex items-center gap-2.5">
        <img src="/logo-mark.webp" alt="" width="120" height="92" className="h-8 w-auto" />
        <span className="hs-display text-[22px] leading-none">HoodStories</span>
      </div>
      <nav aria-label="Stopka" className="flex flex-wrap gap-6 text-[15px]">
        <a href={RULES_URL} target="_blank" rel="noopener noreferrer" className="text-hs-muted hover:text-white" data-testid="footer-rules-link">
          Regulamin
        </a>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-hs-muted hover:text-white" data-testid="footer-discord-link">
          Discord
        </a>
      </nav>
      <p className="text-sm text-hs-meta">
        © 2026 HoodStories · made by <span className="text-hs-chrome">VibingCat</span>
      </p>
    </footer>
  );
}
