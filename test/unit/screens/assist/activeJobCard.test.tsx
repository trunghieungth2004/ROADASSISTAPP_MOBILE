import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {StyleSheet} from "react-native";
import ActiveJobCard from "../../../../src/screens/assist/ActiveJobCard";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";
import type {FeedTicket} from "../../../../src/api/dispatch";

const ticket = {
  id: "t1",
  userId: "u1",
  ticketType: "TOW",
  lat: 10.7,
  lng: 106.6,
  status: "2",
  direction: "out",
} as FeedTicket;

async function render(pills?: string[]) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <ActiveJobCard
        t={en}
        theme={lightTheme}
        ticket={ticket}
        title={en.assist.activeJob}
        line="Rider Nine"
        pills={pills}
        icon="tow"
        tone={lightTheme.primary}
        onPress={jest.fn()}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

test("distance and ETA render as right-aligned pills", async () => {
  const renderer = await render(["1.2 km", "~4 min"]);
  try {
    const row = renderer.root.findByProps({testID: "active-job-pills"});
    const labels = row.findAll((node) => typeof node.props?.children === "string")
      .map((node) => node.props.children as string);
    expect(labels).toContain("1.2 km");
    expect(labels).toContain("~4 min");
    const style = StyleSheet.flatten(row.props.style) as {marginLeft?: string};
    expect(style.marginLeft).toBe("auto");
  } finally {
    renderer.unmount();
  }
});

test("no pill row renders when the card has no distance or ETA", async () => {
  const renderer = await render();
  try {
    expect(renderer.root.findAllByProps({testID: "active-job-pills"})).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});
