import {useEffect, useRef} from "react";
import {Modal, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../ui/AppText";
type Props = {message: string | null; onHide: () => void; duration?: number; severity?: "error" | "info" | "confirm"; sticky?: boolean; bottom?: number; dangerColor?: string; accentColor?: string; action?: {label: string; onPress: () => void}};
export default function Snack({message, onHide, duration = 4000, severity = "info", sticky = false, bottom = 100, dangerColor = "#dc2626", accentColor = "#1d4ed8", action}: Props) {
  const hideRef = useRef(onHide);
  hideRef.current = onHide;
  useEffect(() => {
    if (!message || sticky) return;
    const t = setTimeout(() => hideRef.current(), duration);
    return () => clearTimeout(t);
  }, [message, duration, sticky]);
  if (!message) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onHide} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalRoot} pointerEvents="box-none">
        <View style={[styles.wrap, {bottom}]} pointerEvents="box-none">
          <Pressable
            style={[styles.pill, {backgroundColor: severity === "error" ? dangerColor : severity === "confirm" ? accentColor : "rgba(0,0,0,0.85)"}]}
            pointerEvents={action ? "auto" : "none"}
            onPress={action ? undefined : onHide}
            accessibilityRole={action ? undefined : "button"}
            accessibilityLabel={action ? undefined : message}
          >
            <Text style={styles.text}>{message}</Text>
            {action ? (
              <Pressable onPress={() => action.onPress()} accessibilityRole="button" accessibilityLabel={action.label}>
                <Text style={[styles.action, {color: accentColor}]}>{action.label}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  modalRoot: {flex: 1},
  wrap: {position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 30, elevation: 6},
  pill: {borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, maxWidth: "90%"},
  text: {color: "#fff", fontSize: 13, textAlign: "center"},
  action: {color: "#fff", fontSize: 13, fontWeight: "700", paddingTop: 6},
});
