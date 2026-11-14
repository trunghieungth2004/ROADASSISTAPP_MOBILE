import {useState} from "react";
import {ScrollView, StyleSheet} from "react-native";
import {useRoute} from "@react-navigation/native";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useAppMode} from "../context/ThemeContext";
import {themeForMode, darkTheme, lightTheme} from "../theme";
import ShopBookingsPanel from "./booking/ShopBookingsPanel";

type Params = {providerId?: string};

export default function ShopBookingsScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {providerId} = (useRoute().params ?? {}) as Params;
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {providerId && token ? (
          <ShopBookingsPanel token={token} providerId={providerId} onNotice={setNotice} />
        ) : null}
      </ScrollView>
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
});
