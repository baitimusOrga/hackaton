import type { Messages } from './i18n';
import { BUSINESS_MESSAGES } from './messages/business';
import { ERROR_MESSAGES } from './messages/errors';
import { FIND_MESSAGES } from './messages/find';
import { SAVED_SEARCH_MESSAGES } from './messages/saved-searches';
import { SELL_MESSAGES } from './messages/sell';
import { SHELL_MESSAGES } from './messages/shell';

// One file per area in ./messages/.
export const MESSAGES: Messages = {
  ...SHELL_MESSAGES,
  ...SELL_MESSAGES,
  ...FIND_MESSAGES,
  ...BUSINESS_MESSAGES,
  ...SAVED_SEARCH_MESSAGES,
  ...ERROR_MESSAGES,
};
