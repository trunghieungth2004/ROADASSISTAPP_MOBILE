import {useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text as NativeText, View} from "react-native";
import Overlay from "../../components/overlay/Overlay";
import {useAuth} from "../../context/AuthContext";
import {useStrings} from "../../context/LanguageContext";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import {toMessage} from "../../api/client";
import {getTicket, type FeedTicket} from "../../api/dispatch";
import RecordDetailSheet from "../assist/RecordDetailSheet";
import PaymentDetailSheet from "../bills/PaymentDetailSheet";

type Props = {
  ticketId: string;
  onClose: () => void;
};

const noop = (): void => undefined;

export default function WarrantyTicketSheet({ticketId, onClose}: Props) {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [ticket, setTicket] = useState<FeedTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setTicket(null);
    void getTicket(ticketId, token ?? "").then(
      (raw) => {
        if (!alive) return;
        setTicket({
          ...raw,
          direction: raw.userId === uid ? "out" : "in",
        } as FeedTicket);
      },
      (err: unknown) => {
        if (alive) setError(toMessage(err));
      },
    ).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ticketId, token, uid]);

  if (ticket !== null) {
    return (
      <>
        <RecordDetailSheet
          t={t}
          lang={lang}
          ticket={ticket}
          ratings={[]}
          busy={false}
          uid={uid}
          hasRated
          onClose={onClose}
          onConfirmCancel={noop}
          onRate={noop}
          onAccept={noop}
          onDecline={null}
          onOpenWork={noop}
          onOpenQuote={noop}
          onApproveQuote={noop}
          onOpenShop={noop}
          onOpenDestination={noop}
          onNavigateJob={null}
          acceptHidden
          acceptOffDuty={false}
          towPreview={null}
          onPreviewTowRoute={null}
          linked={null}
          onOpenLinked={noop}
          onAdvance={noop}
          onReply={noop}
          onRateRider={noop}
          ownShopIds={new Set()}
          ownTowId={null}
          ownMobileShopId={null}
          showRequestPhotos
          onDeclineDestination={noop}
          onEditDestination={null}
          allowTowerCancel={false}
          onOpenBill={() => setPaymentOpen(true)}
          payment={null}
          waiting={null}
          bill={null}
          quoteFunded={false}
          quotePayMethod={null}
          roleContext="auto"
          readOnly
        />
        {paymentOpen ? (
          <PaymentDetailSheet
            ticketId={ticket.id}
            onClose={() => setPaymentOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <Overlay
      visible
      variant="sheet"
      title={t.assist.viewTicket}
      closeLabel={t.common.close}
      onClose={onClose}
      scrollable
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <View style={[styles.errorBox, {borderColor: theme.border}]}>
          <NativeText style={{color: theme.danger}}>
            {error ?? t.assist.alreadyGone}
          </NativeText>
        </View>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  center: {paddingVertical: 32, alignItems: "center", justifyContent: "center"},
  errorBox: {borderWidth: 1, borderRadius: 12, padding: 12},
});
