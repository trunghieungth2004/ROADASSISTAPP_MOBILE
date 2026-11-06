import {createNavigationContainerRef} from "@react-navigation/native";

export type RootStackParamList = {
  Tabs: {screen?: string} | undefined;
  Navigation: undefined;
  Diagnostics: undefined;
  Settings: undefined;
  About: undefined;
  Permissions: undefined;
  Providers: undefined;
  Warranty: undefined;
  Bills: undefined;
  Payments: {tab?: "pay" | "receive"; payoutId?: string} | undefined;
  BillDetail: {
    ticketId?: string;
    billId?: string;
    payFirst?: boolean;
    readOnly?: boolean;
    scope?: "payee";
  };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
