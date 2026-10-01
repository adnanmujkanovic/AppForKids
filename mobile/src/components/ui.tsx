// SparkForge native UI kit: the same playful-but-real visual language as the web app.
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "../lib/api";

export const C = {
  violet: "#5b3df5",
  violetDark: "#3e25c4",
  violetSoft: "#ece8ff",
  coral: "#ff6b5b",
  coralDark: "#d94a3b",
  coralSoft: "#ffe7e3",
  sun: "#ffc53d",
  sunDark: "#d69a0b",
  sunSoft: "#fff4d6",
  mint: "#16b895",
  mintDark: "#0c8a6f",
  mintSoft: "#dcf7ef",
  sky: "#2f8cf5",
  skyDark: "#1b66c0",
  skySoft: "#e1efff",
  ink: "#1d1b2e",
  ink2: "#4a4763",
  ink3: "#8a87a3",
  line: "#e8e4f0",
  bg: "#f8f5ff",
  card: "#ffffff",
};

export const TYPE_INFO: Record<string, { emoji: string; label: string }> = {
  game: { emoji: "🎮", label: "Game" },
  app: { emoji: "📱", label: "App" },
  image: { emoji: "🎨", label: "Picture" },
  story: { emoji: "📖", label: "Story" },
  code: { emoji: "⌨️", label: "Code" },
};

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const style = { padding: padded ? 16 : 0, paddingBottom: 32 + insets.bottom, gap: 14 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={style} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

type Tint = "violet" | "sun" | "mint" | "coral" | "sky";
const tints: Record<Tint, string> = { violet: C.violetSoft, sun: C.sunSoft, mint: C.mintSoft, coral: C.coralSoft, sky: C.skySoft };

export function Card({ children, tint, style }: { children: ReactNode; tint?: Tint; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, tint ? { backgroundColor: tints[tint], borderColor: "transparent" } : null, style]}>{children}</View>;
}

export const H1 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.h2, style]}>{children}</Text>;
export const H3 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.h3, style]}>{children}</Text>;
export const P = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.p, style]}>{children}</Text>;
export const Muted = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.muted, style]}>{children}</Text>;

type Variant = "primary" | "ghost" | "mint" | "coral" | "sun" | "sky" | "danger";
const variants: Record<Variant, { bg: string; fg: string; shadow: string; border?: string }> = {
  primary: { bg: C.violet, fg: "#fff", shadow: C.violetDark },
  ghost: { bg: "#fff", fg: C.ink, shadow: C.line, border: C.line },
  mint: { bg: C.mint, fg: "#fff", shadow: C.mintDark },
  coral: { bg: C.coral, fg: "#fff", shadow: C.coralDark },
  sun: { bg: C.sun, fg: C.ink, shadow: C.sunDark },
  sky: { bg: C.sky, fg: "#fff", shadow: C.skyDark },
  danger: { bg: "#fff", fg: "#c7362a", shadow: "transparent", border: "#f3c6c1" },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = variants[variant];
  const pad = size === "sm" ? { paddingVertical: 8, paddingHorizontal: 12 } : size === "lg" ? { paddingVertical: 16, paddingHorizontal: 24 } : { paddingVertical: 12, paddingHorizontal: 18 };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        pad,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, borderBottomColor: v.shadow, opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
        style,
      ]}
    >
      <Text style={[s.btnText, { color: v.fg, fontSize: size === "sm" ? 14 : size === "lg" ? 18 : 16 }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tone = "violet" }: { label: string; selected?: boolean; onPress?: () => void; tone?: "violet" | "gray" | "sun" | "mint" | "coral" | "sky" }) {
  const tones = {
    violet: [C.violetSoft, C.violet],
    gray: ["#f0eef5", C.ink2],
    sun: [C.sunSoft, "#8a5d00"],
    mint: [C.mintSoft, "#08765e"],
    coral: [C.coralSoft, "#b3261e"],
    sky: [C.skySoft, "#185ca8"],
  } as const;
  const [bg, fg] = selected ? [C.violet, "#fff"] : tones[tone];
  const body = (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export const Row = ({ children, style, wrap = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) => (
  <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>
);

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.ink3} style={[s.input, props.multiline ? { minHeight: 90, textAlignVertical: "top" } : null, style]} {...props} />
    </View>
  );
}

export function Toggle({ label, help, value, onChange, disabled }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[s.toggle, disabled ? { opacity: 0.55 } : null]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", color: C.ink }}>{label}</Text>
        {help ? <Muted style={{ fontSize: 13 }}>{help}</Muted> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.violet, false: C.line }} accessibilityLabel={label} />
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center", gap: 12, flex: 1, justifyContent: "center", backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.violet} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function Building({ emoji, label }: { emoji: string; label: string }) {
  return (
    <Screen>
      <Card style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
        <Text style={{ fontSize: 56 }}>{emoji}</Text>
        <H2 style={{ textAlign: "center" }}>{label}</H2>
        <ActivityIndicator color={C.violet} />
        <Muted>AI is putting the pieces together…</Muted>
      </Card>
    </Screen>
  );
}

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? (
    <View style={s.error}>
      <Text style={{ color: "#b3261e", fontWeight: "700" }}>{errorText(error)}</Text>
    </View>
  ) : null;

export const Note = ({ children }: { children: ReactNode }) =>
  children ? (
    <View style={s.note}>
      <Text style={{ color: "#7a5300", fontWeight: "700" }}>{children}</Text>
    </View>
  ) : null;

export function Tile({ emoji, title, sub, onPress, locked }: { emoji: string; title: string; sub: string; onPress?: () => void; locked?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={locked ? undefined : onPress} style={({ pressed }) => [s.tile, locked ? { opacity: 0.55 } : null, pressed ? { transform: [{ scale: 0.98 }] } : null]}>
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <Text style={{ fontWeight: "900", fontSize: 16, color: C.ink }}>{title}</Text>
      <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>{locked ? "🔒 Ask a parent" : sub}</Text>
    </Pressable>
  );
}

export function Certainty({ value }: { value: "sure" | "mostly" | "unsure" }) {
  const m = { sure: ["mint", "✅ Well-known fact"], mostly: ["sun", "🤔 Mostly sure"], unsure: ["coral", "❓ Not sure — check this"] } as const;
  return <Chip tone={m[value][0]} label={m[value][1]} />;
}

export function timeAgo(iso: string) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, gap: 10, shadowColor: "#5b3df5", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  h1: { fontSize: 28, fontWeight: "900", color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: "900", color: C.ink },
  h3: { fontSize: 17, fontWeight: "900", color: C.ink },
  p: { fontSize: 15, lineHeight: 22, color: C.ink, fontWeight: "500" },
  muted: { fontSize: 14, color: C.ink3, fontWeight: "600", lineHeight: 20 },
  btn: { borderRadius: 14, borderWidth: 1, borderBottomWidth: 4, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "800" },
  chip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start" },
  chipText: { fontWeight: "800", fontSize: 13 },
  label: { fontWeight: "800", fontSize: 14, color: C.ink2 },
  input: { minWidth: 0, backgroundColor: "#fff", borderWidth: 2, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: "600", color: C.ink },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: C.line },
  error: { backgroundColor: C.coralSoft, padding: 12, borderRadius: 12 },
  note: { backgroundColor: C.sunSoft, padding: 12, borderRadius: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 4, borderWidth: 1, borderColor: C.line, minHeight: 120 },
});
