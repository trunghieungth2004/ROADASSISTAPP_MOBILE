import {useEffect, useState} from "react";
import {Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {ALL_DIAG_TABS, CHECK_DEFS, type CheckStatus, type DiagTab} from "../services/diagnostics";
import {clearCaptured, getCaptured, isRecording, startRecording, stopRecording, subscribeCaptured, type CapturedLine} from "../services/consoleCapture";

type Props = {
  t: Strings;
  authToken: string | null;
  onClose: () => void;
};

type Entry = {status: CheckStatus; detail: string};

const TABS: {id: DiagTab | "logs"; labelKey: string; icon: string}[] = [
  {id: "push", labelKey: "diagTabPush", icon: "notifications"},
  {id: "location", labelKey: "diagTabLocation", icon: "location-on"},
  {id: "audio", labelKey: "diagTabAudio", icon: "volume-up"},
  {id: "network", labelKey: "diagTabNetwork", icon: "cloud"},
  {id: "logs", labelKey: "diagTabLogs", icon: "terminal"},
];

export default function DiagnosticsScreen({t, authToken, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DiagTab | "logs">("push");
  const [selected, setSelected] = useState<DiagTab[]>(["push", "location", "audio", "network"]);
  const [results, setResults] = useState<Record<string, Entry>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lines, setLines] = useState<CapturedLine[]>(() => getCaptured());
  const [recording, setRecording] = useState(isRecording());
  const [logCopied, setLogCopied] = useState(false);
  useEffect(() => subscribeCaptured(setLines), []);
  const onToggleRecord = (): void => {
    if (isRecording()) {
      stopRecording();
      setRecording(false);
    } else {
      startRecording();
      setRecording(true);
      setLines(getCaptured());
    }
  };
  const onClearLogs = (): void => {
    clearCaptured();
    setLines([]);
  };
  const onCopyLogs = (): void => {
    const text = lines.map((l) => `${new Date(l.at).toISOString()} [${l.level}] ${l.text}`).join("\n");
    void Clipboard.setStringAsync(text).then((ok) => {
      if (ok) {
        setLogCopied(true);
        setTimeout(() => setLogCopied(false), 2000);
      }
    });
  };
  const labelOf = (key: string): string => (t.more as Record<string, string>)[key] ?? key;
  const toggleTab = (id: DiagTab): void => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAll = (): void => {
    setSelected((prev) => (prev.length === 4 ? [] : ["push", "location", "audio", "network"]));
  };
  const onCheck = (): void => {
    if (busy || selected.length === 0) return;
    setBusy(true);
    setCopied(false);
    void (async () => {
      for (const section of ALL_DIAG_TABS) {
        if (!selected.includes(section)) continue;
        const defs = CHECK_DEFS.filter((d) => d.tab === section);
        setResults((prev) => {
          const next = {...prev};
          for (const d of defs) next[d.id] = {status: "running", detail: ""};
          return next;
        });
        const settled = await Promise.all(
          defs.map(async (d) => {
            try {
              const r = await d.run(authToken);
              return {id: d.id, status: r.ok ? "pass" : "fail", detail: r.detail} as Entry & {id: string};
            } catch (err) {
              return {id: d.id, status: "fail", detail: err instanceof Error ? err.message : String(err)} as Entry & {id: string};
            }
          }),
        );
        setResults((prev) => {
          const next = {...prev};
          for (const s of settled) next[s.id] = {status: s.status, detail: s.detail};
          return next;
        });
      }
      setBusy(false);
    })();
  };
  const summary = (): string => {
    const lines = [`roadassist-diagnostics ${new Date().toISOString()}`];
    for (const d of CHECK_DEFS) {
      const r = results[d.id];
      lines.push(`${r?.status ?? "pending"} ${d.id}: ${r?.detail ?? "-"}`);
    }
    return lines.join("\n");
  };
  const onCopy = (): void => {
    void Clipboard.setStringAsync(summary()).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };
  const statusColor = (s: CheckStatus): string =>
    s === "pass" ? "#16a34a" : s === "fail" ? theme.danger : s === "running" ? theme.primary : theme.muted;
  return (
    <View style={[styles.root, {backgroundColor: theme.paper, paddingTop: insets.top + 12}]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{t.more.diagnostics}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      {tab !== "logs" ? (
      <View style={styles.runBar}>
        <Pressable style={styles.masterRow} onPress={toggleAll} accessibilityRole="checkbox" accessibilityState={{checked: selected.length === 4}} accessibilityLabel={t.more.diagSelectAll}>
          <MaterialIcons
            name={selected.length === 4 ? "check-box" : selected.length === 0 ? "check-box-outline-blank" : "indeterminate-check-box"}
            size={22}
            color={theme.primary}
          />
          <Text style={[styles.masterText, {color: theme.text}]}>{t.more.diagSelectAll}</Text>
        </Pressable>
        <Pressable style={[styles.runBtn, {backgroundColor: theme.primary}, (busy || selected.length === 0) && styles.disabled]} disabled={busy || selected.length === 0} onPress={onCheck}>
          <Text style={styles.runText}>{busy ? t.more.diagRunning : t.more.diagRun}</Text>
        </Pressable>
      </View>
      ) : null}
      <View style={styles.tabRow}>
        {TABS.map((tb) => (
          <Pressable
            key={tb.id}
            style={[styles.tab, {borderColor: theme.border, backgroundColor: tab === tb.id ? theme.primary : "transparent"}]}
            onPress={() => setTab(tb.id)}
            accessibilityRole="button"
            accessibilityLabel={labelOf(tb.labelKey)}
          >
            <MaterialIcons name={tb.icon as never} size={18} color={tab === tb.id ? "#fff" : theme.primary} />
            <Text style={[styles.tabText, {color: tab === tb.id ? "#fff" : theme.text}]}>{labelOf(tb.labelKey)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {tab === "logs" ? (
          <View style={styles.box}>
            <View style={styles.logBar}>
              <Pressable style={[styles.runBtn, {backgroundColor: recording ? theme.danger : theme.primary}]} onPress={onToggleRecord} accessibilityRole="button" accessibilityLabel={recording ? t.more.diagStop : t.more.diagRecord}>
                <Text style={styles.runText}>{recording ? `● ${t.more.diagStop} (${lines.length})` : t.more.diagRecord}</Text>
              </Pressable>
              <Pressable style={[styles.runBtn, styles.runOutline, {borderColor: theme.border}]} onPress={onClearLogs} accessibilityRole="button" accessibilityLabel={t.more.diagClear}>
                <Text style={[styles.runText, {color: theme.text}]}>{t.more.diagClear}</Text>
              </Pressable>
            </View>
            <View style={[styles.resultBox, {borderColor: theme.border, backgroundColor: theme.background}]}>
              <View style={styles.resultHead}>
                <Text style={[styles.resultTitle, {color: theme.text}]}>{t.more.diagConsole}</Text>
                <Pressable style={styles.copyBtn} onPress={onCopyLogs} accessibilityRole="button" accessibilityLabel={t.more.diagCopy}>
                  <MaterialIcons name="content-copy" size={20} color={logCopied ? "#16a34a" : theme.primary} />
                </Pressable>
              </View>
              <Text style={[styles.resultText, {color: theme.muted}]}>{lines.length === 0 ? t.more.diagEmpty : lines.slice(-120).map((l) => `[${l.level}] ${l.text}`).join("\n")}</Text>
              {logCopied ? <Text style={[styles.copiedText, {color: "#16a34a"}]}>{t.more.diagCopied}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={styles.box}>
            <Pressable style={styles.sectionRow} onPress={() => toggleTab(tab as DiagTab)} accessibilityRole="checkbox" accessibilityState={{checked: selected.includes(tab as DiagTab)}} accessibilityLabel={labelOf(TABS.find((x) => x.id === tab)?.labelKey ?? tab)}>
              <MaterialIcons name={selected.includes(tab as DiagTab) ? "check-box" : "check-box-outline-blank"} size={22} color={theme.primary} />
              <Text style={[styles.sectionText, {color: theme.text}]}>{t.more.diagSectionChecks}</Text>
            </Pressable>
            {CHECK_DEFS.filter((d) => d.tab === tab).map((d) => {
          const r = results[d.id] ?? {status: "pending", detail: ""};
          return (
            <View key={d.id} style={[styles.row, {borderColor: theme.border}]}>
              <View style={[styles.dot, {backgroundColor: statusColor(r.status)}]} />
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, {color: theme.text}]}>{labelOf(d.labelKey)}</Text>
                {r.detail !== "" ? <Text style={[styles.rowDetail, {color: theme.muted}]}>{r.detail}</Text> : null}
              </View>
              <Text style={[styles.rowStatus, {color: statusColor(r.status)}]}>{r.status.toUpperCase()}</Text>
            </View>
          );
        })}
          </View>
        )}
        {tab !== "logs" ? (
        <View style={[styles.resultBox, {borderColor: theme.border, backgroundColor: theme.background}]}>
          <View style={styles.resultHead}>
            <Text style={[styles.resultTitle, {color: theme.text}]}>{t.more.diagResults}</Text>
            <Pressable style={styles.copyBtn} onPress={onCopy} accessibilityRole="button" accessibilityLabel={t.more.diagCopy}>
              <MaterialIcons name="content-copy" size={20} color={copied ? "#16a34a" : theme.primary} />
            </Pressable>
          </View>
          <Text style={[styles.resultText, {color: theme.muted}]}>{summary()}</Text>
          {copied ? <Text style={[styles.copiedText, {color: "#16a34a"}]}>{t.more.diagCopied}</Text> : null}
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  headRow: {flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8},
  title: {flex: 1, fontSize: 18, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  runBar: {flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 12},
  masterRow: {flex: 1, flexDirection: "row", alignItems: "center", gap: 8},
  masterText: {fontSize: 14, fontWeight: "700"},
  runBtn: {borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center"},
  runText: {color: "#fff", fontWeight: "700"},
  tabRow: {flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 12, flexWrap: "wrap"},
  tab: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingVertical: 8},
  tabText: {fontSize: 12, fontWeight: "700"},
  body: {gap: 8, paddingHorizontal: 16, paddingBottom: 24},
  box: {gap: 8},
  logBar: {flexDirection: "row", gap: 8},
  runOutline: {borderWidth: 1, backgroundColor: "transparent"},
  sectionRow: {flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4},
  sectionText: {fontSize: 15, fontWeight: "700"},
  row: {flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12},
  dot: {width: 10, height: 10, borderRadius: 5},
  rowText: {flex: 1, minWidth: 0, gap: 2},
  rowLabel: {fontSize: 14, fontWeight: "700"},
  rowDetail: {fontSize: 12},
  rowStatus: {fontSize: 11, fontWeight: "700"},
  resultBox: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginTop: 8},
  resultHead: {flexDirection: "row", alignItems: "center"},
  resultTitle: {flex: 1, fontSize: 14, fontWeight: "700"},
  copyBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  resultText: {fontSize: 11, fontFamily: "monospace"},
  copiedText: {fontSize: 12, fontWeight: "700"},
  disabled: {opacity: 0.6},
});
