import { expect, test } from 'bun:test';
import { ASK_SUGGESTIONS } from '../src/lib/askSuggestions';

test('suggestions demonstrate executive analysis instead of FAQ retrieval', () => {
  expect(ASK_SUGGESTIONS).toEqual([
    'Who is the best salesperson in the company, and how much revenue and gross margin did they bring in?',
    'Which verticals performed best last quarter?',
    'How did Mechanical Systems sales change month on month over the past three months?',
  ]);
});
