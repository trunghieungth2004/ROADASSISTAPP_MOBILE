import type {AppealItem} from "../../api/appeals";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

const WARNING = "#b45309";

export type CaseImpact = {
  label: string;
  body: string;
  delta: string | null;
  color: string;
  icon: string;
};

export function humanizeEnum(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function reportReasonLabel(value: string, t: Strings): string {
  if (value === "FAKE_BUSINESS") return t.report.reasonFakeBusiness;
  if (value === "WRONG_LOCATION") return t.report.reasonWrongLocation;
  if (value === "UNSAFE") return t.report.reasonUnsafe;
  if (value === "HARASSMENT") return t.report.reasonHarassment;
  if (value === "SPAM") return t.report.reasonSpam;
  if (value === "INFO_INACCURATE") return t.report.reasonInfoInaccurate;
  if (value === "NO_SHOW") return t.report.reasonNoShow;
  if (value === "LATE") return t.report.reasonLate;
  if (value === "CANCEL_MID") return t.report.reasonCancelMid;
  if (value === "DECLINE_DROPOFF") return t.report.reasonDeclineDropoff;
  if (value === "CONDUCT") return t.report.reasonConduct;
  if (value === "PAYMENT_REFUSED") return t.report.reasonPaymentRefused;
  return t.report.reasonOther;
}

export function reportActionLabel(value: string, t: Strings): string {
  if (value === "WARN") return t.more.caseActionWarn;
  if (value === "RESTRICT") return t.more.caseActionRestrict;
  if (value === "SUSPEND") return t.more.caseActionSuspend;
  if (value === "BLOCK") return t.more.caseActionBlock;
  return t.more.caseDismissed;
}

export function disputeTypeLabel(value: string, t: Strings): string {
  if (value === "FARE_DISPUTE") return t.dispute.typeFareDispute;
  if (value === "SERVICE_QUALITY") return t.dispute.typeServiceQuality;
  if (value === "UNFIXABLE_DISAGREEMENT") return t.dispute.typeUnfixable;
  if (value === "PROVIDER_NO_SHOW") return t.dispute.typeProviderNoShow;
  if (value === "PROVIDER_LATE") return t.dispute.typeProviderLate;
  if (value === "TOWER_CANCEL_MID") return t.dispute.typeTowerCancel;
  if (value === "SHOP_DECLINE_DROPOFF") return t.dispute.typeShopDecline;
  if (value === "RIDER_NO_SHOW") return t.dispute.typeRiderNoShow;
  if (value === "RIDER_PAYMENT") return t.dispute.typeRiderPayment;
  if (value === "SAFETY_CONDUCT") return t.dispute.typeSafety;
  if (value === "RIDER_CONDUCT") return t.dispute.typeRiderConduct;
  if (value === "OTHER") return t.dispute.typeOther;
  return humanizeEnum(value);
}

export function disputeOutcomeLabel(value: string, t: Strings): string {
  if (value === "SHOP") return t.more.outcomeFavorsProvider;
  if (value === "RIDER") return t.more.outcomeFavorsRider;
  if (value === "PARTIAL") return t.more.outcomePartial;
  return humanizeEnum(value);
}

export function appealResolutionLabel(value: string, t: Strings): string {
  if (value === "REMOVE") return t.more.appealRemoved;
  if (value === "KEEP") return t.more.appealKept;
  if (value === "OVERTURN") return t.more.appealOverturned;
  if (value === "UPHOLD") return t.more.appealUpheld;
  if (value === "ADJUST") return t.more.appealAdjusted;
  return humanizeEnum(value);
}

function textOf(item: AppealItem, key: string): string {
  const value = item.snapshot[key];
  return typeof value === "string" || typeof value === "number" ?
    String(value) :
    "";
}

export function caseTitle(item: AppealItem, t: Strings): string {
  if (item.subjectKind === "REPORT") {
    return reportReasonLabel(textOf(item, "reason"), t);
  }
  if (item.subjectKind === "DISPUTE") {
    return disputeTypeLabel(textOf(item, "type"), t);
  }
  return item.label;
}

export function caseImpact(
  item: AppealItem,
  t: Strings,
  theme: AppTheme,
): CaseImpact | null {
  if (item.subjectKind === "REPORT") {
    const action = textOf(item, "action");
    if (item.appealResolution === "OVERTURN") {
      return {
        label: t.more.appealOverturned,
        body: t.more.caseImpactReversed,
        delta: null,
        color: theme.success,
        icon: "check-circle",
      };
    }
    if (action === "NONE" || action === "") {
      return {
        label: t.more.caseDismissed,
        body: t.more.caseNoStandingImpact,
        delta: null,
        color: theme.success,
        icon: "check-circle",
      };
    }
    if (action === "WARN") {
      return {
        label: t.more.caseActionWarn,
        body: t.more.caseImpactNoRestriction,
        delta: `-5 ${t.more.standing}`,
        color: WARNING,
        icon: "warning-amber",
      };
    }
    if (action === "RESTRICT") {
      return {
        label: t.more.caseActionRestrict,
        body: t.more.caseImpactRestricted,
        delta: `-15 ${t.more.standing}`,
        color: theme.danger,
        icon: "lock",
      };
    }
    if (action === "SUSPEND") {
      return {
        label: t.more.caseActionSuspend,
        body: t.more.caseImpactSuspended,
        delta: `-25 ${t.more.standing}`,
        color: theme.danger,
        icon: "block",
      };
    }
    return {
      label: t.more.caseActionBlock,
      body: t.more.caseImpactBlocked,
      delta: `-25 ${t.more.standing}`,
      color: theme.danger,
      icon: "block",
    };
  }
  if (item.subjectKind === "DISPUTE") {
    const outcome = textOf(item, "outcome");
    const amount = Number(textOf(item, "adjustedAmount"));
    return {
      label: outcome === "" ? t.more.caseOutcome : disputeOutcomeLabel(outcome, t),
      body: t.more.caseMoneyOnly,
      delta: Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString()} VND` : null,
      color: theme.primary,
      icon: "payments",
    };
  }
  if (item.appealResolution === "REMOVE") {
    return {
      label: t.more.ratingRemoved,
      body: t.more.caseNoStandingImpact,
      delta: null,
      color: theme.success,
      icon: "star",
    };
  }
  if (item.appealResolution === "KEEP") {
    return {
      label: t.more.appealKept,
      body: t.more.caseNoStandingImpact,
      delta: null,
      color: theme.muted,
      icon: "star",
    };
  }
  if (item.appealStatus === "OPEN") {
    return {
      label: t.more.removalRequested,
      body: t.more.caseNoStandingImpact,
      delta: null,
      color: WARNING,
      icon: "hourglass-empty",
    };
  }
  return null;
}
