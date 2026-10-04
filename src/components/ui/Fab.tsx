import type {ReactNode} from "react";
import {Pressable, StyleSheet, View, type ViewStyle} from "react-native";
import type {AppTheme} from "../../theme";

export type FabVariant = "paper" | "primary" | "danger" | "muted";

type FabProps = {
  theme: AppTheme;
  variant?: FabVariant;
  size?: number;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  hitSlop?: number;
  children: ReactNode;
};

export function Fab({theme, variant = "paper", size = 48, disabled = false, label, onPress, style, hitSlop, children}: FabProps) {
  const backgroundColor = variant === "primary" ? theme.primary : variant === "danger" ? theme.danger : variant === "muted" ? "transparent" : theme.paper;
  const borderColor = variant === "danger" ? theme.danger : variant === "primary" ? theme.primary : theme.border;
  const circle = (
    <View style={[styles.base, {width: size, height: size, borderRadius: size / 2, backgroundColor, borderColor, borderWidth: variant === "danger" ? 0 : 1}, (disabled || variant === "muted") && styles.dim]}>
      {children}
    </View>
  );
  if (!onPress) return <View style={style}>{circle}</View>;
  return (
    <Pressable style={style} hitSlop={hitSlop} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      {circle}
    </Pressable>
  );
}

export function FabColumn({bottom, top, children}: {bottom?: number; top?: number; children: ReactNode}) {
  return <View style={[styles.col, bottom !== undefined && {bottom}, top !== undefined && {top}]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {alignItems: "center", justifyContent: "center"},
  dim: {opacity: 0.4},
  col: {position: "absolute", right: 12, gap: 8, alignItems: "center"},
});
