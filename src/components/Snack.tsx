import {useEffect, useRef} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";
type Props = {message: string | null; onHide: () => void; duration?: number; severity?: "error" | "info"; sticky?: boolean; bottom?: number; dangerColor?: string};
export default function Snack({message, onHide, duration = 4000, severity = "info", sticky = false, bottom = 100, dangerColor = "#dc2626"}: Props) {
  const hideRef = useRef(onHide);
  hideRef.current = onHide;
  useEffect(() => {
    if (!message || sticky) return;
    const t = setTimeout(() => hideRef.current(), duration);
    return () => clearTimeout(t);
  }, [message, duration, sticky]);
  if (!message) return null;
  return (
    <Pressable style={[styles.wrap, {bottom, backgroundColor: severity === "error" ? dangerColor : "rgba(0,0,0,0.85)"}]} onPress={onHide} accessibilityRole="button">
      <View pointerEvents="none">
        <Text style={styles.text}>{message}</Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrap: {position: "absolute", left: 24, right: 24, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center"},
  text: {color: "#fff", fontSize: 14, textAlign: "center"},
});
