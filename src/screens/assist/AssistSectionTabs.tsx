import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {AppTheme} from "../../theme";

export type AssistSection = "request" | "tow" | "records";

export type SectionTab = {id: string; label: string};

type Props = {
  theme: AppTheme;
  tabs: SectionTab[];
  selected: string;
  onChange: (id: string) => void;
};

export default function AssistSectionTabs({theme, tabs, selected, onChange}: Props) {
  return (
    <View style={[styles.segment, {borderColor: theme.border}]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isSelected = selected === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.segmentBtn, isSelected && {backgroundColor: theme.primary}]}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{selected: isSelected}}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.segmentText, {color: isSelected ? "#fff" : theme.text}]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {flexDirection: "row", borderWidth: 1, borderRadius: 999, padding: 4, gap: 4},
  segmentBtn: {flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: "center"},
  segmentText: {fontWeight: "700", fontSize: 14},
});
