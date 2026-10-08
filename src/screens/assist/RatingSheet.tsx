import {useState} from "react";
import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import type {DispatchTicket} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import {ticketTitle} from "./ticketLabels";

type Props = {
  t: Strings;
  ticket: DispatchTicket;
  initialScore: number | null;
  initialComment: string | null;
  busy: boolean;
  onSubmit: (score: number, comment: string) => void;
  onClose: () => void;
};

export default function RatingSheet({t, ticket, initialScore, initialComment, busy, onSubmit, onClose}: Props) {
  const [score, setScore] = useState(initialScore ?? 5);
  const [comment, setComment] = useState(initialComment ?? "");
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.rating.title} · ${ticketTitle(ticket, t)}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.rating.submit, tone: "primary", busy, onPress: () => onSubmit(score, comment.trim())}]}
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
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={comment} onChangeText={setComment} placeholder={t.rating.commentPlaceholder} placeholderTextColor={theme.muted} maxLength={280} />
    </Overlay>
  );
}

const styles = StyleSheet.create({
  stars: {flexDirection: "row", gap: 4, justifyContent: "center", width: "100%", paddingVertical: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
});
