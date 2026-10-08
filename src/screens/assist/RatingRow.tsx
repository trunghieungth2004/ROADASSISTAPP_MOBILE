import {StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {AppTheme} from "../../theme";

export type RatingRowData = {
  id: string;
  score: number;
  text?: string | null;
  reply?: string | null;
  authorName?: string | null;
  replyName?: string | null;
};

export default function RatingRow({theme, rating}: {theme: AppTheme; rating: RatingRowData}) {
  const initial = typeof rating.authorName === "string" && rating.authorName !== "" ?
    rating.authorName.trim().charAt(0).toUpperCase() :
    "?";
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, {backgroundColor: theme.primary}]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
      <View style={styles.body}>
        {typeof rating.authorName === "string" && rating.authorName !== "" ? (
          <Text style={[styles.name, {color: theme.text}]}>{rating.authorName}</Text>
        ) : null}
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <MaterialIcons key={n} name={n <= Math.max(0, Math.min(5, Math.round(rating.score))) ? "star" : "star-border"} size={14} color="#f59e0b" />
          ))}
        </View>
        {typeof rating.text === "string" && rating.text ? (
          <Text style={[styles.coords, {color: theme.text}]}>{rating.text}</Text>
        ) : null}
        {typeof rating.reply === "string" && rating.reply ? (
          <View style={[styles.reply, {borderLeftColor: theme.border}]}>
            {typeof rating.replyName === "string" && rating.replyName !== "" ? (
              <Text style={[styles.coords, {color: theme.text, fontWeight: "700"}]}>{rating.replyName}</Text>
            ) : null}
            <Text style={[styles.coords, {color: theme.muted}]}>{rating.reply}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", gap: 10, alignItems: "flex-start"},
  avatar: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  initial: {color: "#fff", fontSize: 15, fontWeight: "700"},
  body: {flex: 1, gap: 3},
  name: {fontSize: 13, fontWeight: "700"},
  stars: {flexDirection: "row", gap: 1, alignItems: "center"},
  coords: {fontSize: 12},
  reply: {gap: 1, paddingLeft: 8, borderLeftWidth: 2},
});
