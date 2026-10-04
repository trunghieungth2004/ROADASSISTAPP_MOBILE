import {useEffect, useRef} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../ui/AppText";
type Props = {message: string | null; onHide: () => void; duration?: number; severity?: "error" | "info" | "confirm"; sticky?: boolean; bottom?: number; dangerColor?: string; accentColor?: string};
export default function Snack({message, onHide, duration = 4000, severity = "info", sticky = false, bottom = 100, dangerColor = "#dc2626", accentColor = "#1d4ed8"}: Props) {
  const hideRef = useRef(onHide);
  hideRef.current = onHide;
  useEffect(() => {
    if (!message || sticky) return;
    const t = setTimeout(() => hideRef.current(), duration);
    return () => clearTimeout(t);
  }, [message, duration, sticky]);
  if (!message) return null;
  return (
    <Pressable style={[styles.wrap, {bottom}]} onPress={onHide} accessibilityRole="button">
      <View pointerEvents="none" style={[styles.pill, {backgroundColor: severity === "error" ? dangerColor : severity === "confirm" ? accentColor : "rgba(0,0,0,0.85)"}]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrap: {position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 30, elevation: 6},
  pill: {borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, maxWidth: "90%"},
  text: {color: "#fff", fontSize: 13, textAlign: "center"},
});
