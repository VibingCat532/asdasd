const RULES_URL = "https://docs.google.com/document/d/1d6cqpNGjw46U00RSAFRSnhg0yJy4mG7605eh3qtkCIk/edit?usp=sharing";
const DISCORD_URL = "https://discord.gg/hspl";

export default function Footer() {
  return (
    <footer className="py-10 text-center" data-testid="site-footer">
      <p className="text-sm text-zinc-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
        © 2026 HoodStories. Wszelkie prawa zastrzeżone.
      </p>
      <div
        className="mt-3 flex items-center justify-center gap-4 text-sm"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <a
          href={RULES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 transition-colors hover:text-[#00E5FF]"
          data-testid="footer-rules-link"
        >
          Regulamin
        </a>
        <span className="text-zinc-700" aria-hidden="true">
          ·
        </span>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 transition-colors hover:text-[#00E5FF]"
          data-testid="footer-discord-link"
        >
          Discord
        </a>
      </div>
      <p className="mt-3 text-sm text-zinc-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
        made by <span className="text-[#00E5FF]">VibingCat</span>
      </p>
    </footer>
  );
}
