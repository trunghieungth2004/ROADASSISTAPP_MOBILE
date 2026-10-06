import {expect, jest, test} from "@jest/globals";
import {create, type ReactTestRenderer} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Modal, ScrollView, Text} from "react-native";
import Overlay from "../../../src/components/overlay/Overlay";
import OnboardingScreen from "../../../src/screens/OnboardingScreen";
import TurnListSheet from "../../../src/screens/navigation/TurnListSheet";
import VehiclePickerSheet from "../../../src/components/vehicles/VehiclePickerSheet";
import FlagDetailSheet from "../../../src/components/flags/FlagDetailSheet";
import FlagReportDialog from "../../../src/components/flags/FlagReportDialog";
import VehicleCreateDialog from "../../../src/components/vehicles/VehicleCreateDialog";
import SaveRouteDialog from "../../../src/components/routes/SaveRouteDialog";
import SavedRoutesSheet from "../../../src/components/routes/SavedRoutesSheet";
import {en} from "../../../src/i18n/en";
import {darkTheme} from "../../../src/theme";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: null, uid: null}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

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

function scrollViews(rendered: ReactTestRenderer) {
  return rendered.root.findAllByType(ScrollView);
}

function styleOf(element: {props: {style?: unknown}}): Record<string, unknown> {
  const {style} = element.props;
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

test("role picker reflects already-chosen services and registered providers", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.cancel} onClose={() => undefined}>
      <OnboardingScreen
        t={en}
        lang="en"
        token={null}
        selectedServices={["RIDER", "VOLUNTEER"]}
        registered={{shop: true, tow: true}}
        onFinish={() => undefined}
        onSkip={() => undefined}
      />
    </Overlay>,
  );
  const labels = rendered.root.findAllByType(Text).map((n) => {
    const kids = n.props.children;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
  expect(labels).toContain(`${en.roles.shop} — ${en.provider.registered}`);
  expect(labels).toContain(`${en.roles.tow} — ${en.provider.registered}`);
  expect(labels).not.toContain(en.provider.addressUnset);
  const checked = rendered.root.findAll((n) => n.props?.accessibilityState?.checked === true);
  expect(checked.length).toBeGreaterThanOrEqual(4);
  rendered.unmount();
});

test("role picker marks services-only roles as chosen pending setup", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.cancel} onClose={() => undefined}>
      <OnboardingScreen
        t={en}
        lang="en"
        token={null}
        selectedServices={["RIDER", "SHOP"]}
        registered={{shop: false, tow: false}}
        onFinish={() => undefined}
        onSkip={() => undefined}
      />
    </Overlay>,
  );
  const labels = rendered.root.findAllByType(Text).map((n) => {
    const kids = n.props.children;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
  expect(labels).toContain(`${en.roles.shop} — ${en.provider.chosenNeedsDetails}`);
  expect(labels).toContain(`${en.roles.tow} — ${en.roles.towHint}`);
  rendered.unmount();
});

test("role picker form scrolls inside a fullScreen overlay", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.close} onClose={() => undefined}>
      <OnboardingScreen t={en} lang="en" token={null} onFinish={() => undefined} onSkip={() => undefined} />
    </Overlay>,
  );
  const scrollers = scrollViews(rendered);
  expect(scrollers.length).toBeGreaterThan(0);
  for (const scroller of scrollers) {
    expect(styleOf(scroller).flex).toBe(1);
  }
  rendered.unmount();
});

test("every dialog and sheet body scrolls through the universal overlay scroller", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title="t" closeLabel={en.common.close} onClose={() => undefined}>
      <TurnListSheet
        t={en}
        theme={darkTheme}
        steps={[{at: [106.6, 10.7], kind: "turn-left", distMeters: 10, durationSec: 5}]}
        stepProg={[0]}
        streets={{}}
        progress={null}
        onPreviewStep={() => undefined}
      />
    </Overlay>,
  );
  const scrollers = scrollViews(rendered);
  expect(scrollers.length).toBe(1);
  expect(scrollers[0].props.showsVerticalScrollIndicator).not.toBe(false);
  rendered.unmount();
});

test("vehicle picker list renders inside a sheet overlay", () => {
  const rendered = mount(
    <Overlay visible variant="sheet" title={en.vehicle.title} closeLabel={en.common.close} onClose={() => undefined}>
      <VehiclePickerSheet t={en} theme={darkTheme} token={null} activeId={null} onPick={() => undefined} />
    </Overlay>,
  );
  expect(scrollViews(rendered).length).toBeGreaterThan(0);
  rendered.unmount();
});

test("flag detail renders inside a dialog overlay", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title={en.flag.reportTitle} closeLabel={en.common.close} onClose={() => undefined}>
      <FlagDetailSheet
        t={en}
        flag={{id: "f1", type: "FLOOD", lat: 1, lng: 2, status: "1", note: "x".repeat(280)}}
        isOwn={false}
      />
    </Overlay>,
  );
  expect(scrollViews(rendered).length).toBeGreaterThan(0);
  rendered.unmount();
});

test("saved routes list renders inside a dialog overlay", () => {
  const rendered = mount(
    <Overlay visible variant="dialog" title={en.saved.title} closeLabel={en.common.close} onClose={() => undefined}>
      <SavedRoutesSheet t={en} token={null} onOpen={() => undefined} />
    </Overlay>,
  );
  expect(scrollViews(rendered).length).toBeGreaterThan(0);
  rendered.unmount();
});

test("flag report dialog exposes its submit as a footer action", () => {
  const rendered = mount(
    <FlagReportDialog t={en} lat={1} lng={2} onClose={() => undefined} onSubmit={() => undefined} />,
  );
  const modal = rendered.root.findByType(Modal);
  expect(modal.props.visible).toBe(true);
  const actions = rendered.root.findAll((n) => n.props?.accessibilityLabel === en.flag.submit);
  expect(actions.length).toBeGreaterThan(0);
  rendered.unmount();
});

test("flag report dialog shows fully with no scroller", () => {
  const rendered = mount(
    <FlagReportDialog t={en} lat={1} lng={2} onClose={() => undefined} onSubmit={() => undefined} />,
  );
  const actions = rendered.root.findAll((n) => n.props?.accessibilityLabel === en.flag.submit);
  expect(actions.length).toBeGreaterThan(0);
  expect(scrollViews(rendered).length).toBe(0);
  rendered.unmount();
});

test("vehicle create dialog pins its save without a scroller", () => {
  const rendered = mount(
    <VehicleCreateDialog t={en} theme={darkTheme} token={null} onClose={() => undefined} onCreated={() => undefined} />,
  );
  const actions = rendered.root.findAll((n) => n.props?.accessibilityLabel === en.common.save);
  expect(actions.length).toBeGreaterThan(0);
  expect(scrollViews(rendered).length).toBe(0);
  rendered.unmount();
});

test("save route dialog pins its save without a scroller", () => {
  const rendered = mount(
    <SaveRouteDialog
      t={en}
      theme={darkTheme}
      originText="A"
      destText="B"
      distanceM={1000}
      durationSec={60}
      busy={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />,
  );
  const actions = rendered.root.findAll((n) => n.props?.accessibilityLabel === en.common.save);
  expect(actions.length).toBeGreaterThan(0);
  expect(scrollViews(rendered).length).toBe(0);
  rendered.unmount();
});

test("onboarding shop form toggles vehicle classes keeping one", () => {
  const rendered = mount(
    <Overlay visible variant="fullScreen" closeLabel={en.common.cancel} onClose={() => undefined}>
      <OnboardingScreen
        t={en}
        lang="en"
        token={null}
        onFinish={() => undefined}
        onSkip={() => undefined}
      />
    </Overlay>,
  );
  const {act} = require("react-test-renderer");
  const subtreeText = (node: {findAll: (p: (n: {props?: {children?: unknown}}) => boolean) => {props?: {children?: unknown}}[]}): string =>
    node.findAll((n) => typeof n.props?.children === "string" || Array.isArray(n.props?.children)).map((n) => (Array.isArray(n.props?.children) ? (n.props.children as unknown[]).join("") : String(n.props?.children ?? ""))).join(" ");
  const shopOption = rendered.root.findAll((n) => typeof n.props?.onPress === "function").find((n) => subtreeText(n as never).includes(`${en.roles.shop} — ${en.roles.shopHint}`));
  expect(shopOption).toBeDefined();
  act(() => {
    shopOption?.props.onPress();
  });
  const chip = (label: string) => rendered.root.findAll((n) => n.props?.accessibilityLabel === label).find((n) => typeof n.props?.onPress === "function");
  expect(chip(en.shop.vehicleBike)?.props.accessibilityState?.checked).toBe(true);
  expect(chip(en.shop.vehicleCar)?.props.accessibilityState?.checked).toBe(true);
  act(() => {
    chip(en.shop.vehicleCar)?.props.onPress();
  });
  expect(chip(en.shop.vehicleBike)?.props.accessibilityState?.checked).toBe(true);
  expect(chip(en.shop.vehicleCar)?.props.accessibilityState?.checked).toBe(false);
  act(() => {
    chip(en.shop.vehicleBike)?.props.onPress();
  });
  expect(chip(en.shop.vehicleBike)?.props.accessibilityState?.checked).toBe(true);
  rendered.unmount();
});
