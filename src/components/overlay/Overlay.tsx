import type {ReactNode} from "react";
import {ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppText as Text} from "../ui/AppText";
import {darkTheme, lightTheme} from "../../theme";

export type OverlayVariant = "fullScreen" | "dialog" | "sheet";

export type OverlayActionTone = "primary" | "neutral" | "danger";

export type OverlayAction = {
  label: string;
  onPress: () => void;
  tone?: OverlayActionTone;
  outline?: boolean;
  busy?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  variant: OverlayVariant;
  title?: string;
  leading?: ReactNode;
  right?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  actions?: OverlayAction[];
  scrollable?: boolean;
  children: ReactNode;
};

function dismissAnd(run: () => void): void {
  Keyboard.dismiss();
  run();
}

function DismissButton({closeLabel, onClose}: {closeLabel: string; onClose: () => void}) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <Pressable
      style={styles.closeBtn}
      onPress={() => dismissAnd(onClose)}
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
    >
      <MaterialIcons name="close" size={22} color={theme.text} />
    </Pressable>
  );
}

function Header({title, leading, right, trailing}: {title?: string; leading?: ReactNode; right?: ReactNode; trailing?: ReactNode}) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={styles.headRow}>
      {leading}
      <Text style={[styles.title, {color: theme.text}]}>{title ?? ""}</Text>
      {right}
      {trailing}
    </View>
  );
}

function Footer({actions}: {actions: OverlayAction[]}) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={styles.actionRow}>
      {actions.map((action) => {
        const tone = action.tone ?? "primary";
        const filled = !action.outline;
        const toneColor = tone === "danger" ? theme.danger : tone === "primary" ? theme.primary : theme.text;
        const borderColor = tone === "danger" ? theme.danger : tone === "primary" ? theme.primary : theme.border;
        const textColor = filled ? "#fff" : toneColor;
        const off = action.busy === true || action.disabled === true;
        return (
          <Pressable
            key={action.label}
            style={[styles.actionBtn, filled ? {backgroundColor: toneColor} : {borderColor, borderWidth: 1, backgroundColor: "transparent"}, off && styles.disabled]}
            disabled={off}
            onPress={() => dismissAnd(action.onPress)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            {action.busy === true ? <ActivityIndicator color={textColor} /> : <Text style={[styles.actionText, {color: textColor}]}>{action.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Overlay({visible, variant, title, leading, right, closeLabel, onClose, actions, scrollable, children}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  if (variant === "fullScreen") {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.full, {backgroundColor: theme.background}]}>{children}</View>
      </Modal>
    );
  }
  const footed = actions && actions.length > 0;
  const scrolls = scrollable ?? true;
  const body = scrolls ? (
    <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticBody}>{children}</View>
  );
  if (variant === "sheet") {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.sheetRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismissAnd(onClose)}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
          <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: insets.bottom + 12}]}>
            <View style={styles.handle} />
            <Header title={title} leading={leading} right={right} trailing={<DismissButton closeLabel={closeLabel} onClose={onClose} />} />
            {body}
            {footed ? <Footer actions={actions} /> : null}
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.dialogRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismissAnd(onClose)}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={[styles.dialog, !scrolls && styles.dialogFree, {backgroundColor: theme.paper}]}>
            <Header title={title} leading={leading} right={right} />
            {body}
            {footed ? <Footer actions={actions} /> : null}
            <Pressable
              style={[styles.cancelRow, {borderColor: theme.border}]}
              onPress={() => dismissAnd(onClose)}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            >
              <Text style={[styles.actionText, {color: theme.text}]}>{closeLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  full: {flex: 1},
  dialogRoot: {flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)"},
  dialogWrap: {width: "100%", paddingHorizontal: 24},
  dialog: {borderRadius: 16, padding: 16, gap: 12, maxHeight: "85%", width: "100%"},
  dialogFree: {maxHeight: undefined},
  sheetRoot: {flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)"},
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "70%", width: "100%"},
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: "#a3a3a3", alignSelf: "center"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  body: {flexShrink: 1},
  staticBody: {width: "100%"},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {fontWeight: "700"},
  cancelRow: {borderWidth: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  disabled: {opacity: 0.6},
});
