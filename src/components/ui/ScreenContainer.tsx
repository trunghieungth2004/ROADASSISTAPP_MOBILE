import {StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {darkTheme, lightTheme} from "../../theme";
export default function ScreenContainer({children}: {children: React.ReactNode}) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  return <View style={[styles.outer, {backgroundColor: theme.background, paddingBottom: insets.bottom}]}><View style={styles.inner}>{children}</View></View>;
}
const styles = StyleSheet.create({outer: {flex: 1}, inner: {flex: 1, width: "100%", maxWidth: 600, alignSelf: "center"}});
