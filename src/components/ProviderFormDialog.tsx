import {MaterialIcons} from "@expo/vector-icons";
import ProviderFormSheet from "./ProviderFormSheet";
import {useProviderDraft} from "./useProviderDraft";
import Overlay from "./overlay/Overlay";
import PlaceSearchScreen from "../screens/PlaceSearchScreen";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import {useColorScheme} from "react-native";
import type {Provider} from "../api/providers";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  token: string | null;
  kind: "SHOP" | "TOW";
  provider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProviderFormDialog({t, token, kind, provider, onClose, onSaved}: Props) {
  const {lang} = useStrings();
  const {token: authToken} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const draft = useProviderDraft(kind, provider, t);
  async function save(): Promise<void> {
    if (!token) return;
    if (await draft.submit(token)) onSaved();
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={provider ? t.provider.edit : kind === "TOW" ? t.provider.registerTow : t.provider.addShop}
      leading={<MaterialIcons name={kind === "TOW" ? "local-shipping" : "storefront"} size={20} color={theme.primary} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.common.save, tone: "primary", busy: draft.busy, onPress: () => void save()}]}
    >
      <ProviderFormSheet t={t} draft={draft} />
      <Overlay visible={draft.shopSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => draft.setShopSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={authToken ?? token ?? undefined}
          lang={lang}
          title={t.provider.shopAddress}
          placeholder={t.provider.shopAddress}
          onPick={draft.onPickPlace}
          onClose={() => draft.setShopSearch(false)}
        />
      </Overlay>
    </Overlay>
  );
}
