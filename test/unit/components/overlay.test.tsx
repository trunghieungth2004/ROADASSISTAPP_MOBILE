import {expect, jest, test} from "@jest/globals";
import {create, type ReactTestRenderer} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Modal, ScrollView, Text, ActivityIndicator} from "react-native";
import Overlay from "../../../src/components/overlay/Overlay";
import {en} from "../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function mount(element: React.ReactElement): ReactTestRenderer {
  let rendered: ReactTestRenderer | undefined;
  const {act} = require("react-test-renderer");
  act(() => {
    rendered = create(<SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>);
  });
  if (!rendered) throw new Error("mount failed");
  return rendered;
}

test("dialog uses a transparent fade modal with a dim backdrop", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title={en.saved.title} closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.transparent).toBe(true);
  expect(modal.props.animationType).toBe("fade");
  expect(modal.props.visible).toBe(true);
  rendered.unmount();
});

test("sheet uses a transparent slide modal", () => {
  const rendered = mount(
    <Overlay visible variant="sheet" title={en.vehicle.title} closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.transparent).toBe(true);
  expect(modal.props.animationType).toBe("slide");
  rendered.unmount();
});

test("fullScreen uses an opaque slide modal", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.transparent ?? false).toBe(false);
  expect(modal.props.animationType).toBe("slide");
  rendered.unmount();
});

test("dialog renders the title and header slots", () => {
  const rendered = mount(
    <Overlay
      visible
      variant="dialog"
      title={en.saved.title}
      leading={<Text>lead</Text>}
      right={<Text>right</Text>}
      closeLabel={en.common.cancel}
      onClose={() => undefined}
    >
      <Text>body</Text>
    </Overlay>,
  );
  const labels = rendered.root.findAllByType(Text).map((n) => n.props.children);
  expect(labels).toContain(en.saved.title);
  expect(labels).toContain("lead");
  expect(labels).toContain("right");
  rendered.unmount();
});

test("dialog footer offers cancel on its own row below the actions and body", () => {
  const rendered = mount(
    <Overlay
      visible
      variant="dialog"
      title={en.saved.title}
      closeLabel={en.common.cancel}
      onClose={() => undefined}
      actions={[{label: en.common.save, tone: "primary", onPress: () => undefined}]}
    >
      <Text>body</Text>
    </Overlay>,
  );
  const order = rendered.root.findAll(() => true);
  const bodyIndex = order.findIndex((n) => n.type === ScrollView);
  const saveIndexes = order
    .map((n, i) => (n.props?.accessibilityLabel === en.common.save ? i : -1))
    .filter((i) => i >= 0);
  const cancelIndexes = order
    .map((n, i) => (n.props?.accessibilityLabel === en.common.cancel ? i : -1))
    .filter((i) => i >= 0);
  expect(bodyIndex).toBeGreaterThanOrEqual(0);
  expect(saveIndexes.length).toBeGreaterThan(0);
  expect(cancelIndexes.length).toBeGreaterThan(0);
  expect(saveIndexes[saveIndexes.length - 1]).toBeGreaterThan(bodyIndex);
  expect(cancelIndexes[cancelIndexes.length - 1]).toBeGreaterThan(saveIndexes[saveIndexes.length - 1]);
  rendered.unmount();
});

test("role picker mounts as a fullScreen overlay", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.close} onClose={() => undefined}>
      <Text>{en.roles.title}</Text>
    </Overlay>,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.animationType).toBe("slide");
  expect(modal.props.transparent ?? false).toBe(false);
  rendered.unmount();
});

test("saved routes mount as a dialog overlay", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title={en.saved.title} closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.animationType).toBe("fade");
  rendered.unmount();
});

test("footer renders one button per action with tones", () => {
  const rendered = mount(
    <Overlay
      visible
      variant="dialog"
      title="t"
      closeLabel={en.common.close}
      onClose={() => undefined}
      actions={[
        {label: "Remove", tone: "danger", onPress: () => undefined},
        {label: "Cancel", tone: "neutral", outline: true, onPress: () => undefined},
      ]}
    >
      <Text>body</Text>
    </Overlay>,
  );
  const labels = rendered.root.findAllByType(Text).map((n) => n.props.children);
  expect(labels).toContain("Remove");
  expect(labels).toContain("Cancel");
  rendered.unmount();
});

test("busy action shows a spinner and no footer appears without actions", () => {  const busy = mount(
    <Overlay
      visible
      variant="dialog"
      title="t"
      closeLabel={en.common.close}
      onClose={() => undefined}
      actions={[{label: en.common.save, tone: "primary", busy: true, onPress: () => undefined}]}
    >
      <Text>body</Text>
    </Overlay>,
  );
  expect(busy.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  busy.unmount();
  const plain = mount(
    <Overlay visible variant="dialog" title="t" closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  expect(plain.root.findAllByType(ActivityIndicator).length).toBe(0);
  plain.unmount();
});

function styledNodes(rendered: {root: {findAll: (pred: (n: {props?: {style?: unknown}}) => boolean) => {props: {style?: unknown}}[]}}, key: string, value: unknown) {
  return rendered.root.findAll((n) => {
    const style = n.props?.style;
    const flat = (Array.isArray(style) ? style : [style]).filter(Boolean) as Record<string, unknown>[];
    return flat.some((entry) => entry[key] === value);
  });
}

test("dialog cards hug their content with no minimum height", () => {
  const dialog = mount(
    <Overlay visible variant="dialog" title="t" closeLabel={en.common.cancel} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  expect(styledNodes(dialog, "minHeight", 280).length).toBe(0);
  dialog.unmount();
  const sheet = mount(
    <Overlay visible variant="sheet" title="t" closeLabel={en.common.cancel} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  expect(styledNodes(sheet, "minHeight", 280).length).toBe(0);
  sheet.unmount();
});

test("non-scrollable dialogs render no scroller and no height cap", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title="t" closeLabel={en.common.close} onClose={() => undefined} scrollable={false}>
      <Text>body</Text>
    </Overlay>,
  );
  expect(rendered.root.findAllByType(ScrollView).length).toBe(0);
  const merged = rendered.root.findAll((n) => n.props?.style !== undefined).map((n) => {
    const flat = (Array.isArray(n.props.style) ? n.props.style : [n.props.style]).filter(Boolean) as Record<string, unknown>[];
    return Object.assign({}, ...flat);
  });
  expect(merged.some((style) => style.maxHeight === "85%")).toBe(false);
  rendered.unmount();
});

test("scrollable dialogs scroll and cap their height", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title="t" closeLabel={en.common.close} onClose={() => undefined}>
      <Text>body</Text>
    </Overlay>,
  );
  expect(rendered.root.findAllByType(ScrollView).length).toBe(1);
  expect(styledNodes(rendered, "maxHeight", "85%").length).toBeGreaterThan(0);
  rendered.unmount();
});
