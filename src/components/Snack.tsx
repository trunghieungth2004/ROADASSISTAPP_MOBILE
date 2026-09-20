import {useEffect, useRef} from "react";
import {StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";
type Props = {message: string | null; onHide: () => void; duration?: number};
export default function Snack({message, onHide, duration = 4000}: Props) {
  const hideRef = useRef(onHide);
  hideRef.current = onHide;
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => hideRef.current(), duration);
    return () => clearTimeout(t);
  }, [message, duration]);
  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {position: "absolute", left: 24, right: 24, bottom: 100, backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center"},
  text: {color: "#fff", fontSize: 14, textAlign: "center"},
});
