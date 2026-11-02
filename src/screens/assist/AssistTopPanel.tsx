import type {ReactNode} from "react";
import {Pressable, StyleSheet, useWindowDimensions, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {AppTheme} from "../../theme";

type Props = {
  theme: AppTheme;
  top: number;
  hasJobCard: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onShow: () => void;
  showLabel: string;
  collapseLabel: string;
  expandLabel: string;
  billStrip: ReactNode;
  children: ReactNode;
  onLayoutHeight: (height: number) => void;
};

export default function AssistTopPanel({
  theme,
  top,
  hasJobCard,
  collapsed,
  onToggle,
  onShow,
  showLabel,
  collapseLabel,
  expandLabel,
  billStrip,
  children,
  onLayoutHeight,
}: Props) {
  const {height} = useWindowDimensions();
  const maxPanel = Math.max(320, Math.min(560, Math.round(height * 0.62)));
  if (hasJobCard && collapsed) {
    return (
      <Pressable
        style={[styles.showPanel, {top, backgroundColor: theme.paper, borderColor: theme.border}]}
        onPress={onShow}
        accessibilityRole="button"
        accessibilityLabel={expandLabel}
      >
        <MaterialIcons name="expand-more" size={20} color={theme.primary} />
        <Text style={[styles.collapseText, {color: theme.text}]}>{showLabel}</Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.topContainer, {top}]}>
      <View
        onLayout={(event) => onLayoutHeight(event.nativeEvent.layout.height)}
        style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border, maxHeight: maxPanel}]}
      >
        <View style={styles.cardBody}>
          {billStrip}
          {children}
        </View>
        {hasJobCard ? (
          <Pressable
            style={styles.collapseBar}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={collapseLabel}
          >
            <MaterialIcons name="expand-less" size={22} color={theme.primary} />
            <Text style={[styles.collapseText, {color: theme.text}]}>{collapseLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topContainer: {position: "absolute", left: 12, right: 12},
  showPanel: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
  },
  cardBody: {gap: 8, flexShrink: 1},
  collapseBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  collapseText: {fontSize: 12, fontWeight: "700"},
});
