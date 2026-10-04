import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {DispatchTicket} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import {ticketTitle} from "./ticketLabels";

type Props = {
  t: Strings;
  ticket: DispatchTicket;
  initialScore: number | null;
  busy: boolean;
  onSubmit: (score: number) => void;
  onClose: () => void;
};

export default function RatingSheet({t, ticket, initialScore, busy, onSubmit, onClose}: Props) {
  const [score, setScore] = useState(initialScore ?? 5);
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.rating.title} · ${ticketTitle(ticket, t)}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.rating.submit, tone: "primary", busy, onPress: () => onSubmit(score)}]}
    >
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setScore(n)}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{checked: score === n}}
            accessibilityLabel={`${n}`}
          >
            <MaterialIcons name={n <= score ? "star" : "star-border"} size={32} color="#f59e0b" />
          </Pressable>
        ))}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  stars: {flexDirection: "row", gap: 4, justifyContent: "center", width: "100%", paddingVertical: 8},
});
