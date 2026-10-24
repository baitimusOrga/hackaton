import type { Messages } from './i18n';
import { AUCTION_MESSAGES } from './messages/auction';
import { BUSINESS_MESSAGES } from './messages/business';
import { ERROR_MESSAGES } from './messages/errors';
import { FIND_MESSAGES } from './messages/find';
import { SELL_MESSAGES } from './messages/sell';
import { SHELL_MESSAGES } from './messages/shell';

// One file per area in ./messages/.
export const MESSAGES: Messages = {
  ...SHELL_MESSAGES,
  ...SELL_MESSAGES,
  ...FIND_MESSAGES,
  ...AUCTION_MESSAGES,
  ...BUSINESS_MESSAGES,
  ...ERROR_MESSAGES,
};
