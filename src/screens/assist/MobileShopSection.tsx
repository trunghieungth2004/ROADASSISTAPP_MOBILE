import {View, StyleSheet} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {DispatchTicket, FeedTicket} from "../../api/dispatch";
import StatusRow from "../../components/ui/StatusRow";
import TicketRow from "./TicketRow";

type Props = {
  t: Strings;
  theme: AppTheme;
  tickets: DispatchTicket[];
  loading: boolean;
  locationMissing: boolean;
  onOpen: (ticket: FeedTicket) => void;
};

function toFeed(ticket: DispatchTicket, t: Strings): FeedTicket {
  const riderName = typeof ticket.riderName === "string" && ticket.riderName !== "" ?
    ticket.riderName :
    t.assist.unassigned;
  return {
    ...ticket,
    direction: "in",
    otherParty: {id: ticket.userId, name: riderName, kind: "RIDER"},
  } as FeedTicket;
}

export default function MobileShopSection({
  t,
  theme,
  tickets,
  loading,
  locationMissing,
  onOpen,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.section, {color: theme.text}]}>
        {t.assist.mobileShopRequests}
      </Text>
      {locationMissing ? (
        <Text style={[styles.hint, {color: theme.muted}]}>
          {t.assist.towLocationNeeded}
        </Text>
      ) : loading && tickets.length === 0 ? (
        <StatusRow theme={theme} text={t.common.loading} />
      ) : tickets.length === 0 ? (
        <Text style={[styles.hint, {color: theme.muted}]}>
          {t.assist.noNearby}
        </Text>
      ) : (
        tickets.map((ticket) => {
          const row = toFeed(ticket, t);
          return (
            <TicketRow
              key={ticket.id}
              t={t}
              theme={theme}
              ticket={row}
              kind="SHOP"
              onPress={() => onOpen(row)}
            />
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  section: {fontSize: 15, fontWeight: "700"},
  hint: {fontSize: 12},
});