/**
 * The three questions the panel offers before anything is typed. Each one is
 * also in the regression set (scripts/ask_regression.ts asserts it), so what
 * the room sees first is what the gate proves.
 */
export const ASK_SUGGESTIONS: readonly string[] = [
  'Who is the best salesperson in the company, and how much revenue and gross margin did they bring in?',
  'Which verticals performed best last quarter?',
  'How did Mechanical Systems sales change month on month over the past three months?',
];

/** The browser gives up on an answer after this long and says so in words. */
export const ASK_CLIENT_TIMEOUT_MS = 30_000;
