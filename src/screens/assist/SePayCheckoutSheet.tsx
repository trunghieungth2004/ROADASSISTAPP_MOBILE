import {useMemo, useRef, useState} from "react";
import {ActivityIndicator, Platform, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {WebView} from "react-native-webview";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {SepayCheckout} from "../../api/dispatch";
import {darkTheme, lightTheme} from "../../theme";
import {useAppMode} from "../../context/ThemeContext";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";

type Props = {
  t: Strings;
  url: string;
  checkout?: SepayCheckout | null;
  status: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onCancel: () => void;
  onFailure: () => void;
  onSwitchToCash?: () => void;
};

function resultOf(url: string): "success" | "error" | "cancel" | null {
  const match = /[?&]payment=(success|error|cancel)(?:&|$)/.exec(url);
  return match === null ? null : match[1] as "success" | "error" | "cancel";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function checkoutHtml(checkout: SepayCheckout): string {
  const fields = Object.entries(checkout.fields)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join("");
  return "<!doctype html><html><head><meta charset=\"utf-8\" />" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />" +
    "</head><body onload=\"document.forms[0].submit()\">" +
    `<form method="${escapeHtml(checkout.method || "POST")}" action="${escapeHtml(checkout.action)}">` +
    `${fields}</form></body></html>`;
}

export default function SePayCheckoutSheet({t, url, checkout, status, busy, error, onClose, onSuccess, onCancel, onFailure, onSwitchToCash}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const finished = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  function finish(next: "success" | "error" | "cancel"): false {
    if (!finished.current) {
      finished.current = true;
      if (next === "success") onSuccess();
      else if (next === "cancel") onCancel();
      else onFailure();
    }
    return false;
  }
  function handleUrl(next: string): boolean {
    const result = resultOf(next);
    if (result !== null) return finish(result);
    return true;
  }
  const source = useMemo(
    () => checkout ?
      {html: checkoutHtml(checkout), baseUrl: checkout.action} :
      {uri: url},
    [checkout, url],
  );
  return (
    <Overlay
      visible
      variant="fullScreen"
      closeLabel={t.common.cancel}
      onClose={busy ? () => undefined : onClose}
    >
      <View style={[styles.root, {backgroundColor: theme.background, paddingTop: insets.top}]}>
        <View style={[styles.header, {borderBottomColor: theme.divider}]}>
          <Pressable
            style={styles.back}
            onPress={busy ? undefined : onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.cancel}
          >
            <MaterialIcons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, {color: theme.text}]}>{t.assist.sepayQrTitle}</Text>
            <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.sepayQrHint}</Text>
          </View>
          <TicketStatusPill t={t} theme={theme} status={status} />
          {onSwitchToCash ? (
            <Pressable
              style={[styles.cashBtn, {borderColor: theme.border}]}
              onPress={busy ? undefined : onSwitchToCash}
              accessibilityRole="button"
              accessibilityLabel={t.assist.cashInstead}
            >
              <Text style={[styles.cashText, {color: theme.primary}]}>{t.assist.cashInstead}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.iconBtn}
            onPress={() => webRef.current?.reload()}
            accessibilityRole="button"
            accessibilityLabel={t.assist.reloadQr}
          >
            <MaterialIcons name="refresh" size={20} color={theme.text} />
          </Pressable>
        </View>
        {error !== null || loadError !== null ? (
          <View style={[styles.error, {borderColor: theme.danger, backgroundColor: theme.paper}]}>
            <MaterialIcons name="error-outline" size={18} color={theme.danger} />
            <Text style={[styles.hint, {color: theme.danger, flex: 1}]}>{error ?? loadError}</Text>
          </View>
        ) : null}
        <View style={styles.webWrap}>
          <WebView
            ref={webRef}
            testID="sepay-webview"
            source={source}
            style={styles.web}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            mixedContentMode="compatibility"
            applicationNameForUserAgent="RoadAssist"
            setSupportMultipleWindows={false}
            {...(Platform.OS === "android" ? {scalesPageToFit: true, forceDarkOn: false, androidLayerType: "hardware" as const} : {})}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(request) => handleUrl(request.url)}
            onNavigationStateChange={(state) => {
              const result = resultOf(state.url);
              if (result !== null) finish(result);
            }}
            onError={() => {
              setLoading(false);
              setLoadError(t.assist.sepayFailed);
            }}
            onHttpError={() => {
              setLoading(false);
              setLoadError(t.assist.sepayFailed);
            }}
          />
          {loading && !busy ? (
            <View pointerEvents="none" style={[styles.loadingPill, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingText, {color: theme.muted}]}>{t.common.loading}</Text>
            </View>
          ) : null}
          {busy ? (
            <View style={[styles.verifying, {backgroundColor: theme.background + "e6"}]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.verifyingText, {color: theme.text}]}>{t.assist.sepayVerifying}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, width: "100%"},
  header: {flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1},
  back: {width: 40, height: 40, alignItems: "center", justifyContent: "center"},
  headerText: {flex: 1, minWidth: 0, gap: 2},
  title: {fontSize: 16, fontWeight: "800"},
  hint: {fontSize: 12},
  cashBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9},
  cashText: {fontSize: 12, fontWeight: "700"},
  iconBtn: {width: 36, height: 36, alignItems: "center", justifyContent: "center"},
  error: {margin: 12, borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  webWrap: {flex: 1},
  web: {flex: 1},
  loadingPill: {position: "absolute", top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12},
  loadingText: {fontSize: 12, fontWeight: "600"},
  verifying: {position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 10},
  verifyingText: {fontSize: 14, fontWeight: "700"},
});
