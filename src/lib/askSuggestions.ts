/**
 * The three questions the panel offers before anything is typed. Each one is
 * also in the regression set (scripts/ask_regression.ts asserts it), so what
 * the room sees first is what the gate proves.
 */
export const ASK_SUGGESTIONS: readonly string[] = [
  'Which vertical is furthest behind budget on year to date revenue?',
  'What is the full-year revenue forecast against budget?',
  'How much is past due across the division?',
];

/** The browser gives up on an answer after this long and says so in words. */
export const ASK_CLIENT_TIMEOUT_MS = 30_000;
