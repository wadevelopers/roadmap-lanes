import { getLanguage } from "obsidian";

import { createTranslatorForLanguage, type Translator } from "./messages";

export type { TranslationKey, Translator } from "./messages";

export function createTranslator(language = getLanguage()): Translator {
	return createTranslatorForLanguage(language);
}
