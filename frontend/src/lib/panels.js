export const CATEGORY_LABELS = {
  general: "Ogólna",
  factions: "Frakcja",
  complaints: "Panel skarg",
};

export const getCategory = (recruitment) => recruitment?.category || "general";

export function pluralQuestions(count) {
  if (count === 1) return "pytanie";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "pytania" : "pytań";
}

export function pluralApplications(count) {
  if (count === 1) return "zgłoszenie";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "zgłoszenia" : "zgłoszeń";
}

const MINOR_WORDS = new Set(["na", "i", "w", "z", "do", "the", "of", "and"]);
const VOWELS = /[aeiouyąęó]/i;

// "Atlanta Police Department" -> "APD", "Administracja" -> "ADM", "Hounds" -> "HND".
export function panelMonogram(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((word) => !MINOR_WORDS.has(word.toLowerCase()));
  if (significant.length >= 2) {
    return significant.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
  }
  const word = (significant[0] || words[0] || "?").replace(/[^\p{L}\p{N}]/gu, "");
  const consonants = word.slice(1).split("").filter((char) => !VOWELS.test(char));
  return (word[0] + consonants.slice(0, 2).join("")).toUpperCase() || "?";
}

function parseHex(color) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(color || "").trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a, b, amount) {
  return a.map((channel, i) => Math.round(channel * amount + b[i] * (1 - amount)));
}

const toHex = (rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

// The panel's own colour as a dark tile with a light mark, readable on the dark surface.
export function panelTint(themeColor) {
  const rgb = parseHex(themeColor) || [76, 198, 209];
  return {
    background: toHex(mix(rgb, [13, 16, 17], 0.18)),
    color: toHex(mix(rgb, [255, 255, 255], 0.6)),
  };
}

// The first line of a description is its lead; every further line is a rule worth highlighting.
export function splitDescription(description = "") {
  const lines = String(description).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return { lead: lines[0] || "", notes: lines.slice(1) };
}

export function discordAvatarUrl(discordId, avatar, size = 64) {
  return avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${size}` : null;
}
