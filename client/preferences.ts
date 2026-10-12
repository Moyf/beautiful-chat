import { useSyncExternalStore } from "react";

export const ACCENT_PRESETS = {
  host: undefined,
  jade: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
} as const;

/** `"custom"` follows `accentCustomColor`, which the picker edits. */
export type AccentPreset = keyof typeof ACCENT_PRESETS | "custom";
export type UiFontPreference = "inter" | "system";
export type CodeFontPreference = "code" | "plain";
export type MarkdownVariantPreference = "document" | "compact" | "terminal";

/**
 * Highlighter pastels, the colours a real marker leaves on paper. `null` is
 * the built-in wash the mark style falls back to; `"custom"` (in the type)
 * follows `markCustomColor`.
 */
export const MARK_COLOR_PRESETS = {
  default: null,
  yellow: "#ffd43b",
  green: "#8ce99a",
  blue: "#74c0fc",
  pink: "#fcc2d7",
  orange: "#ffc078",
} as const;
export type MarkColorPreset = keyof typeof MARK_COLOR_PRESETS | "custom";

/**
 * Text-weight colours for bold, picked from the Radix text steps so one hex
 * holds its contrast on dark and light surfaces alike. `null` keeps bold
 * inheriting the text colour; `"accent"` follows the theme's accent.
 */
export const BOLD_COLOR_PRESETS = {
  inherit: null,
  accent: "accent",
  rose: "#e64980",
  orange: "#f76707",
  green: "#40c057",
  blue: "#228be6",
  violet: "#845ef7",
} as const;
export type BoldColorPreset = keyof typeof BOLD_COLOR_PRESETS | "custom";

export interface EnhancerPreferences {
  accent: AccentPreset;
  uiFont: UiFontPreference;
  codeFont: CodeFontPreference;
  frostedGlass: boolean;
  /**
   * A light that follows the pointer across a card. Web and desktop only:
   * touch platforms have no hover, so the attribute is inert there.
   */
  pointerGlow: boolean;
  /**
   * Paseo maps a stream item to the plugin timeline item before any transformer
   * runs, and that mapping carries only the text. Pasted images therefore never
   * reach plugin code, so the enhanced bubble cannot draw them. Turning this off
   * hands prompts back to the host, whose own bubble still shows them.
   */
  enhancedUserBubble: boolean;
  /**
   * The Copy / Add to chat bar that follows a highlight. Web and desktop only:
   * iOS and Android route selection through the platform's own menu, which the
   * plugin cannot extend, so the toggle has no effect there.
   */
  selectionActions: boolean;
  /**
   * The plugin's own markdown rendering for assistant replies. Off hands the
   * turn back to Paseo's renderer, which is the safety valve: the plugin
   * cannot import the host markdown pipeline, so its version is a reasonable
   * subset rather than a superset.
   */
  assistantMarkdown: boolean;
  /** Which look the markdown renderer uses. */
  markdownVariant: MarkdownVariantPreference;
  /** Renders ==text== in a reply as a marker highlight. Off shows the syntax as typed. */
  markSyntax: boolean;
  markColor: MarkColorPreset;
  boldColor: BoldColorPreset;

  /** The hex behind each `"custom"` choice, edited by the colour picker. */
  accentCustomColor: string;
  markCustomColor: string;
  boldCustomColor: string;
}

const STORAGE_KEY = "paseo/beautiful-chat/preferences/v1";

export const DEFAULT_PREFERENCES: Readonly<EnhancerPreferences> = {
  accent: "host",
  uiFont: "inter",
  codeFont: "code",
  frostedGlass: true,
  pointerGlow: true,
  enhancedUserBubble: true,
  selectionActions: true,
  assistantMarkdown: true,
  markdownVariant: "document",
  markSyntax: false,
  markColor: "default",
  boldColor: "inherit",
  accentCustomColor: "#38bdf8",
  markCustomColor: "#f5d90a",
  boldCustomColor: "#e64980",
};

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  const candidate = globalThis as typeof globalThis & { localStorage?: Storage };
  return candidate.localStorage;
}

function isAccentPreset(value: unknown): value is AccentPreset {
  return value === "custom" || (typeof value === "string" && value in ACCENT_PRESETS);
}

function isMarkColorPreset(value: unknown): value is MarkColorPreset {
  return value === "custom" || (typeof value === "string" && value in MARK_COLOR_PRESETS);
}

function isBoldColorPreset(value: unknown): value is BoldColorPreset {
  return value === "custom" || (typeof value === "string" && value in BOLD_COLOR_PRESETS);
}

/** Keeps a custom hex well-formed; anything else falls back to the default. */
function normalizeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function loadPreferences(): EnhancerPreferences {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    const candidate = JSON.parse(stored) as Partial<EnhancerPreferences>;
    return {
      accent: isAccentPreset(candidate.accent) ? candidate.accent : DEFAULT_PREFERENCES.accent,
      uiFont: candidate.uiFont === "system" ? "system" : DEFAULT_PREFERENCES.uiFont,
      codeFont: candidate.codeFont === "plain" ? "plain" : DEFAULT_PREFERENCES.codeFont,
      frostedGlass:
        typeof candidate.frostedGlass === "boolean"
          ? candidate.frostedGlass
          : DEFAULT_PREFERENCES.frostedGlass,
      pointerGlow:
        typeof candidate.pointerGlow === "boolean"
          ? candidate.pointerGlow
          : DEFAULT_PREFERENCES.pointerGlow,
      enhancedUserBubble:
        typeof candidate.enhancedUserBubble === "boolean"
          ? candidate.enhancedUserBubble
          : DEFAULT_PREFERENCES.enhancedUserBubble,
      selectionActions:
        typeof candidate.selectionActions === "boolean"
          ? candidate.selectionActions
          : DEFAULT_PREFERENCES.selectionActions,
      assistantMarkdown:
        typeof candidate.assistantMarkdown === "boolean"
          ? candidate.assistantMarkdown
          : DEFAULT_PREFERENCES.assistantMarkdown,
      markdownVariant:
        candidate.markdownVariant === "compact" || candidate.markdownVariant === "terminal"
          ? candidate.markdownVariant
          : DEFAULT_PREFERENCES.markdownVariant,
      markSyntax:
        typeof candidate.markSyntax === "boolean"
          ? candidate.markSyntax
          : DEFAULT_PREFERENCES.markSyntax,
      markColor: isMarkColorPreset(candidate.markColor)
        ? candidate.markColor
        : DEFAULT_PREFERENCES.markColor,
      boldColor: isBoldColorPreset(candidate.boldColor)
        ? candidate.boldColor
        : DEFAULT_PREFERENCES.boldColor,
      accentCustomColor: normalizeHex(
        candidate.accentCustomColor,
        DEFAULT_PREFERENCES.accentCustomColor,
      ),
      markCustomColor: normalizeHex(
        candidate.markCustomColor,
        DEFAULT_PREFERENCES.markCustomColor,
      ),
      boldCustomColor: normalizeHex(
        candidate.boldCustomColor,
        DEFAULT_PREFERENCES.boldCustomColor,
      ),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

let preferences = loadPreferences();

function publish(): void {
  for (const listener of listeners) listener();
}

export function getEnhancerPreferences(): EnhancerPreferences {
  return preferences;
}

export function updateEnhancerPreferences(update: Partial<EnhancerPreferences>): void {
  preferences = { ...preferences, ...update };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Browser storage can be disabled. Keep the change alive for this session.
  }
  publish();
}

export function resetEnhancerPreferences(): void {
  preferences = { ...DEFAULT_PREFERENCES };
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Keep the default session value if storage is unavailable.
  }
  publish();
}

export function useEnhancerPreferences(): EnhancerPreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getEnhancerPreferences,
    getEnhancerPreferences,
  );
}
