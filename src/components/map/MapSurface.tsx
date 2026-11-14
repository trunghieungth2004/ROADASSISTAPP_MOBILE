import {useCallback, useEffect, useState, type ComponentProps, type ReactNode} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle} from "react-native";
import {Map} from "@maplibre/maplibre-react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../ui/AppText";
import {useStrings} from "../../context/LanguageContext";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {config} from "../../config";

type MapProps = ComponentProps<typeof Map>;
type Props = MapProps & {
  children?: ReactNode;
  fallbackStyle?: StyleProp<ViewStyle>;
  probe?: () => Promise<boolean>;
};

export default function MapSurface({
  style,
  children,
  fallbackStyle,
  probe: probeOverride,
  onDidFailLoadingMap,
  onDidFinishLoadingStyle,
  ...rest
}: Props) {
  const {t} = useStrings();
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [retryKey, setRetryKey] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);
  const [probing, setProbing] = useState(false);
  const failed = mapFailed || probeFailed;

  const probe = useCallback(async (): Promise<void> => {
    if (probeOverride !== undefined) {
      setProbing(true);
      try {
        setProbeFailed(!(await probeOverride()));
      } catch {
        setProbeFailed(true);
      } finally {
        setProbing(false);
      }
      return;
    }
    if (process.env.NODE_ENV === "test") return;
    if (config.maptilerKey === "") {
      setProbeFailed(true);
      return;
    }
    setProbing(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const url = "https://api.maptiler.com/sprites/general/sprite.json" +
        `?key=${encodeURIComponent(config.maptilerKey)}`;
      const response = await fetch(url, {signal: controller.signal});
      setProbeFailed(!response.ok);
    } catch {
      setProbeFailed(true);
    } finally {
      clearTimeout(timer);
      setProbing(false);
    }
  }, [probeOverride]);

  useEffect(() => {
    void probe();
  }, [probe, retryKey]);

  const retry = (): void => {
    setMapFailed(false);
    setProbeFailed(false);
    setRetryKey((value) => value + 1);
  };

  return (
    <View style={[styles.wrap, style, fallbackStyle]}>
      <Map
        {...rest}
        key={retryKey}
        style={StyleSheet.absoluteFill}
        onDidFailLoadingMap={(event) => {
          setMapFailed(true);
          onDidFailLoadingMap?.(event);
        }}
        onDidFinishLoadingStyle={(event) => {
          setMapFailed(false);
          onDidFinishLoadingStyle?.(event);
        }}
      >
        {children}
      </Map>
      {failed ? (
        <View style={[styles.fallback, {backgroundColor: theme.background}]}>
          <View style={[styles.icon, {backgroundColor: theme.danger + "18"}]}>
            <MaterialIcons name="map" size={28} color={theme.danger} />
          </View>
          <Text style={[styles.title, {color: theme.text}]}>{t.map.unavailableTitle}</Text>
          <Text style={[styles.body, {color: theme.muted}]}>{t.map.unavailableBody}</Text>
          <Pressable
            style={[styles.retry, {backgroundColor: theme.primary}]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel={t.common.retry}
          >
            {probing ? <ActivityIndicator color="#fff" /> : <Text style={styles.retryText}>{t.common.retry}</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {overflow: "hidden"},
  fallback: {position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 10, padding: 24},
  icon: {width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center"},
  title: {fontSize: 16, fontWeight: "700", textAlign: "center"},
  body: {fontSize: 13, textAlign: "center", lineHeight: 19},
  retry: {borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, minWidth: 110, alignItems: "center"},
  retryText: {color: "#fff", fontWeight: "700", fontSize: 13},
});
