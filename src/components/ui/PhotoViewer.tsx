import {useState, type ReactNode} from "react";
import {Image, Modal, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";

type Props = {
  uri: string | null;
  closeLabel: string;
  onClose: () => void;
};

export default function PhotoViewer({uri, closeLabel, onClose}: Props) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        {uri !== null ? <Image source={{uri}} style={styles.image} resizeMode="contain" /> : null}
        <Pressable style={styles.cancelRow} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}>
          <Text style={styles.cancelText}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function usePhotoViewer(closeLabel: string): {open: (uri: string) => void; node: ReactNode} {
  const [uri, setUri] = useState<string | null>(null);
  return {
    open: (next: string) => setUri(next),
    node: <PhotoViewer uri={uri} closeLabel={closeLabel} onClose={() => setUri(null)} />,
  };
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: "#000", paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32, gap: 16},
  image: {flex: 1, width: "100%"},
  cancelRow: {borderWidth: 1, borderColor: "#fff", borderRadius: 8, padding: 10, alignItems: "center"},
  cancelText: {color: "#fff", fontWeight: "700"},
});
