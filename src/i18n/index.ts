import { en, type Lang, type Strings } from "./en";
import { vi } from "./vi";

export type { Lang, Strings };
export const strings: Record<Lang, Strings> = { en, vi };
