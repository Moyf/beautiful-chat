import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { hostFontEscape } from "./components/host-font-escape";
import { radius, buildThemeTokens, type ExtendedThemeTokens } from "./components/theme-tokens";
import {
  ACCENT_PRESETS,
  BOLD_COLOR_PRESETS,
  MARK_COLOR_PRESETS,
  resetEnhancerPreferences,
  updateEnhancerPreferences,
  useEnhancerPreferences,
  type AccentPreset,
  type BoldColorPreset,
  type CodeFontPreference,
  type MarkColorPreset,
  type UiFontPreference,
} from "./preferences";

const MARK_COLOUR_OPTIONS: ReadonlyArray<{
  value: MarkColorPreset;
  label: string;
  color: string | null;
}> = [
  { value: "default", label: "Default", color: null },
  { value: "yellow", label: "Yellow", color: MARK_COLOR_PRESETS.yellow },
  { value: "green", label: "Mint", color: MARK_COLOR_PRESETS.green },
  { value: "blue", label: "Sky", color: MARK_COLOR_PRESETS.blue },
  { value: "pink", label: "Rose", color: MARK_COLOR_PRESETS.pink },
  { value: "orange", label: "Peach", color: MARK_COLOR_PRESETS.orange },
];

/** The accent swatch resolves against the live theme, so it is built per render. */
function boldColourOptions(accent: string): ReadonlyArray<{
  value: BoldColorPreset;
  label: string;
  color: string | null;
}> {
  return [
    { value: "inherit", label: "Inherit", color: null },
    { value: "accent", label: "Accent", color: accent },
    { value: "rose", label: "Rose", color: BOLD_COLOR_PRESETS.rose },
    { value: "orange", label: "Orange", color: BOLD_COLOR_PRESETS.orange },
    { value: "green", label: "Green", color: BOLD_COLOR_PRESETS.green },
    { value: "blue", label: "Blue", color: BOLD_COLOR_PRESETS.blue },
    { value: "violet", label: "Violet", color: BOLD_COLOR_PRESETS.violet },
  ];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const HUE_STEPS = 24;

/** Converts one hue at the picker's fixed saturation and lightness to hex. */
function hueToHex(hue: number): string {
  const s = 0.72;
  const l = 0.55;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * A colour picker built from the runtime's own primitives: a strip of hue
 * steps for quick picks and a hex field for an exact colour. A stepped strip
 * stands in for a gradient — the plugin sandbox admits no SVG to draw one —
 * and twenty-four steps read as continuous at chip width.
 */
function ColourPicker({
  hex,
  onChange,
  tokens,
}: {
  hex: string;
  onChange(hex: string): void;
  tokens: ExtendedThemeTokens;
}) {
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);
  const valid = HEX_RE.test(draft);

  const commit = (): void => {
    if (valid) onChange(draft.toLowerCase());
    else setDraft(hex);
  };

  return (
    <View style={styles.picker}>
      <View style={styles.hueStrip}>
        {Array.from({ length: HUE_STEPS }, (_, index) => {
          const hue = Math.round((360 / HUE_STEPS) * index);
          return (
            <Pressable
              key={hue}
              accessibilityRole="button"
              accessibilityLabel={`Hue ${hue} degrees`}
              onPress={() => onChange(hueToHex(hue))}
              style={[styles.hueChip, { backgroundColor: hueToHex(hue) }]}
            />
          );
        })}
      </View>
      <View style={styles.hexRow}>
        <View
          style={[
            styles.swatch,
            { backgroundColor: valid ? draft : tokens.border, width: 18, height: 18 },
          ]}
        />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          maxLength={7}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="#f5d90a"
          placeholderTextColor={tokens.foregroundSubtle}
          style={[
            styles.hexInput,
            {
              color: tokens.foreground,
              borderColor: valid ? tokens.borderSubtle : tokens.dangerBorder,
            },
          ]}
        />
      </View>
    </View>
  );
}

const TRACK_WIDTH = 38;
const TRACK_HEIGHT = 22;
const KNOB = 16;

/**
 * An on/off control that reads as one. A pair of buttons states the value
 * twice — the label and the selection — and a reader has to compare them to
 * learn which way it is set.
 */
function Toggle({
  value,
  onChange,
  label,
  tokens,
}: {
  value: boolean;
  onChange(next: boolean): void;
  label: string;
  tokens: ExtendedThemeTokens;
}) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: 140,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [value, position]);

  return (
    <Pressable
      accessibilityRole="switch"
      // React Native Web does not map `accessibilityState.checked` onto a
      // Pressable, so the ARIA attribute is set directly as well.
      aria-checked={value}
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? tokens.accent : tokens.surface2,
          borderColor: value ? tokens.accent : tokens.border,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: value ? tokens.accentForeground : tokens.foregroundMuted,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TRACK_WIDTH - KNOB - 6],
                }),
              },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

/** A row whose control is a toggle: text on the left, switch on the right. */
function ToggleRow({
  title,
  description,
  value,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange(next: boolean): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <View style={[styles.row, styles.toggleRow, { borderTopColor: tokens.borderSubtle }]}>
      <View style={styles.toggleText}>
        <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
          {title}
        </Text>
        <Text
          style={[
            styles.rowDescription,
            { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
          ]}
        >
          {description}
        </Text>
      </View>
      <Toggle value={value} onChange={onChange} label={title} tokens={tokens} />
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
  tokens,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: selected ? tokens.accentBg : tokens.surface2,
          borderColor: selected ? tokens.accent : tokens.borderSubtle,
        },
      ]}
    >
      <Text
        style={[
          styles.optionLabel,
          { color: selected ? tokens.accent : tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange(value: T): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
      <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.rowDescription,
          { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {description}
      </Text>
      <View style={styles.options}>
        {options.map((option) => (
          <OptionButton
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            tokens={tokens}
          />
        ))}
      </View>
    </View>
  );
}

/** A choice row whose options carry a colour swatch, for picking a text colour. */
function SwatchRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  tokens,
  customColor,
}: {
  title: string;
  description: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; color: string | null }>;
  onChange(value: T): void;
  tokens: ExtendedThemeTokens;
  /** When given, a Custom chip is appended and selecting it reveals the picker. */
  customColor?: { hex: string; onChange(hex: string): void };
}) {
  const allOptions: ReadonlyArray<{ value: T; label: string; color: string | null }> =
    customColor
      ? [...options, { value: "custom" as T, label: "Custom", color: customColor.hex }]
      : options;

  return (
    <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
      <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.rowDescription,
          { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {description}
      </Text>
      <View style={styles.options}>
        {allOptions.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`${title}: ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? tokens.accentBg : tokens.surface2,
                  borderColor: selected ? tokens.accent : tokens.borderSubtle,
                },
              ]}
            >
              <View
                style={[styles.swatch, { backgroundColor: option.color ?? tokens.border }]}
              />
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: selected ? tokens.accent : tokens.foregroundMuted,
                    fontFamily: tokens.fontUi,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {customColor && value === "custom" ? (
        <ColourPicker hex={customColor.hex} onChange={customColor.onChange} tokens={tokens} />
      ) : null}
    </View>
  );
}

/** Settings content mounted by Paseo under the selected host's Plugin settings. */
export function BeautifulChatSettingsPage({ theme }: PluginSurfaceProps) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(
    () => buildThemeTokens(theme.colors, preferences),
    [preferences, theme.colors],
  );

  return (
    <View {...hostFontEscape} style={[styles.container, { backgroundColor: tokens.surface0 }]}>
      <View
        style={[
          styles.intro,
          { borderColor: tokens.borderSubtle, backgroundColor: tokens.surface1 },
        ]}
      >
        <Text style={[styles.title, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
          Chat presentation
        </Text>
        <Text
          style={[styles.description, { color: tokens.foregroundMuted, fontFamily: tokens.fontUi }]}
        >
          Changes apply to every enhanced tool call, reasoning trace, checklist, and prompt in this
          client.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceGlass },
        ]}
      >
        <SwatchRow<AccentPreset>
          title="Accent colour"
          description="Use the current Paseo theme, pick a presentation accent, or mix your own."
          value={preferences.accent}
          options={[
            { value: "host", label: "Host theme", color: theme.colors.accent },
            { value: "jade", label: "Jade", color: ACCENT_PRESETS.jade },
            { value: "violet", label: "Violet", color: ACCENT_PRESETS.violet },
            { value: "amber", label: "Amber", color: ACCENT_PRESETS.amber },
            { value: "rose", label: "Rose", color: ACCENT_PRESETS.rose },
          ]}
          customColor={{
            hex: preferences.accentCustomColor,
            onChange: (accentCustomColor) => updateEnhancerPreferences({ accentCustomColor }),
          }}
          onChange={(accent) => updateEnhancerPreferences({ accent })}
          tokens={tokens}
        />

        <ChoiceRow<UiFontPreference>
          title="Interface font"
          description="Choose the embedded Inter face or the system interface face."
          value={preferences.uiFont}
          options={[
            { value: "inter", label: "Inter" },
            { value: "system", label: "System" },
          ]}
          onChange={(uiFont) => updateEnhancerPreferences({ uiFont })}
          tokens={tokens}
        />

        <ChoiceRow<CodeFontPreference>
          title="Code glyphs"
          description="Use programming ligatures inside syntax blocks, or keep every code glyph literal."
          value={preferences.codeFont}
          options={[
            { value: "code", label: "Ligatures" },
            { value: "plain", label: "Literal" },
          ]}
          onChange={(codeFont) => updateEnhancerPreferences({ codeFont })}
          tokens={tokens}
        />

        <ChoiceRow
          title="Text size"
          description="Scales the text this plugin draws, from replies and code blocks to callouts and badges."
          value={String(preferences.textScale)}
          options={[
            { value: "0.9", label: "Small" },
            { value: "1", label: "Default" },
            { value: "1.15", label: "Large" },
            { value: "1.3", label: "XL" },
          ]}
          onChange={(textScale) => updateEnhancerPreferences({ textScale: Number(textScale) })}
          tokens={tokens}
        />

        <ToggleRow
          title="Auto-collapse tools"
          description="Folds a tool card back up once it finishes. A failed call stays open, and a card you opened or closed yourself keeps its state."
          value={preferences.autoCollapseTools}
          onChange={(autoCollapseTools) => updateEnhancerPreferences({ autoCollapseTools })}
          tokens={tokens}
        />

        <ToggleRow
          title="Collapse thinking"
          description="Starts a thinking stream folded; open one to read the reasoning while it streams."
          value={preferences.collapseThinking}
          onChange={(collapseThinking) => updateEnhancerPreferences({ collapseThinking })}
          tokens={tokens}
        />

        <ToggleRow
          title="Highlight marks"
          description="Renders ==text== in a reply as a marker highlight. Off keeps the equals signs as typed. The model only uses the syntax when its instructions ask for it."
          value={preferences.markSyntax}
          onChange={(markSyntax) => updateEnhancerPreferences({ markSyntax })}
          tokens={tokens}
        />

        {preferences.markSyntax ? (
          <SwatchRow<MarkColorPreset>
            title="Mark colour"
            description="The wash behind highlighted text."
            value={preferences.markColor}
            options={MARK_COLOUR_OPTIONS}
            customColor={{
              hex: preferences.markCustomColor,
              onChange: (markCustomColor) => updateEnhancerPreferences({ markCustomColor }),
            }}
            onChange={(markColor) => updateEnhancerPreferences({ markColor })}
            tokens={tokens}
          />
        ) : null}

        <SwatchRow<BoldColorPreset>
          title="Bold colour"
          description="The colour bold text takes in a reply. Inherit keeps the surrounding text colour."
          value={preferences.boldColor}
          options={boldColourOptions(theme.colors.accent)}
          customColor={{
            hex: preferences.boldCustomColor,
            onChange: (boldCustomColor) => updateEnhancerPreferences({ boldCustomColor }),
          }}
          onChange={(boldColor) => updateEnhancerPreferences({ boldColor })}
          tokens={tokens}
        />

        <ToggleRow
          title="Frosted glass"
          description="Blur surfaces where the host supports it, or use solid surfaces instead."
          value={preferences.frostedGlass}
          onChange={(frostedGlass) => updateEnhancerPreferences({ frostedGlass })}
          tokens={tokens}
        />

        <ToggleRow
          title="Pointer glow"
          description="A soft light follows the pointer across each card. Desktop and web only: touch platforms have no hover, and the light is skipped when the system asks for reduced motion."
          value={preferences.pointerGlow}
          onChange={(pointerGlow) => updateEnhancerPreferences({ pointerGlow })}
          tokens={tokens}
        />

        <ToggleRow
          title="Enhanced prompt bubble"
          description="Paseo removes pasted images before a plugin sees the message, so the enhanced bubble cannot show them. Turn this off for Paseo's own bubble with image previews. New prompts follow the change."
          value={preferences.enhancedUserBubble}
          onChange={(enhancedUserBubble) => updateEnhancerPreferences({ enhancedUserBubble })}
          tokens={tokens}
        />

        <ToggleRow
          title="Selection actions"
          description="Highlighting text in a callout raises a small bar with Copy and Add to chat. Add to chat drops the highlight into the composer as a quote, or a fenced block when it came from code. Desktop and web only: iOS and Android use the platform's own selection menu."
          value={preferences.selectionActions}
          onChange={(selectionActions) => updateEnhancerPreferences({ selectionActions })}
          tokens={tokens}
        />

        <ToggleRow
          title="Assistant markdown"
          description="Draws the reply with the plugin's own headings, lists and syntax-highlighted code blocks. The plugin cannot reach Paseo's markdown pipeline, so its version is a subset: turn this off for mermaid diagrams, images, and the host's file-path links."
          value={preferences.assistantMarkdown}
          onChange={(assistantMarkdown) => updateEnhancerPreferences({ assistantMarkdown })}
          tokens={tokens}
        />

        <ChoiceRow
          title="Markdown style"
          description="Document is airy and built for long answers. Compact tightens the spacing for short replies. Terminal sets the body in the code face."
          value={preferences.markdownVariant}
          options={[
            { value: "document", label: "Document" },
            { value: "compact", label: "Compact" },
            { value: "terminal", label: "Terminal" },
          ]}
          onChange={(markdownVariant) => updateEnhancerPreferences({ markdownVariant })}
          tokens={tokens}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={resetEnhancerPreferences}
        style={[styles.reset, { borderColor: tokens.borderSubtle }]}
      >
        <Text
          style={[styles.resetText, { color: tokens.foregroundMuted, fontFamily: tokens.fontUi }]}
        >
          Reset defaults
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // No `flex: 1` here. The host mounts a settings screen inside a plain
  // column `View` (app `plugins/settings/index.tsx:107`), and React Native Web
  // compiles `flex: 1` to `flex: 1 1 0%` — a zero basis in a container that
  // sizes to its content, so the whole page collapses to nothing.
  container: { alignSelf: "stretch", padding: 16, gap: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  // The text column takes the slack so a long description wraps instead of
  // pushing the switch off the card.
  toggleText: { flex: 1, minWidth: 0, gap: 8 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  intro: { padding: 14, borderWidth: 1, borderRadius: radius.card, gap: 4 },
  title: { fontSize: 16, fontWeight: "700" },
  description: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: radius.card, overflow: "hidden" },
  row: { padding: 14, gap: 8, borderTopWidth: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowDescription: { fontSize: 12, lineHeight: 17 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderRadius: radius.block, paddingHorizontal: 10, paddingVertical: 7 },
  optionLabel: { fontSize: 12, fontWeight: "600" },
  swatch: { width: 12, height: 12, borderRadius: radius.chip },
  picker: { marginTop: 2, gap: 8 },
  hueStrip: { flexDirection: "row", gap: 1 },
  hueChip: { flex: 1, height: 20, borderRadius: 2 },
  hexRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.block,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  reset: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.block,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  resetText: { fontSize: 12, fontWeight: "600" },
});
