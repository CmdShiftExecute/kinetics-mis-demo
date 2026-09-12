# Ask the MIS, in plain words

What happens when someone asks the "Ask the MIS" panel a question, and why the answer can be trusted or is withheld.

## What happens, step by step

1. The reader opens the panel with Ctrl+K, Cmd+K, or the "Ask the MIS" button, and types one question.
2. The service picks the files the question needs: the division roll-up always, plus one vertical file and one engineer file if the question names one.
3. Those files, a fixed set of rules, and a field guide defining every term go to Claude on the principal's own subscription, through the command line, on this server, and no further.
4. The model quotes figures exactly as published, never calculates, and names the report page where those figures appear.
5. The model also writes, under its answer, one citation per figure: the exact place in the data the figure came from. Code with no interest in agreeing follows every citation, confirms the value matches to the digit, confirms the sentence names the right row, and for a "which is highest" question confirms that row really is the extreme of its table.
6. A clean answer and its page link are shown. A draft that fails any check is tried once more and, if it fails again, withheld: the reader is told the draft could not be shown and is pointed at the nearest report.
7. When the data genuinely has no answer, the model says so rather than guess.

## Why a number cannot be invented

This is enforced mechanically, not merely by instruction. The model is told never to add, average or estimate silently: a computed figure must show its inputs and its working, and the working is recomputed by code before it is shown. After it replies, code with no interest in agreeing follows every citation back to its row, checks the value to the digit, and checks that every number in the prose exists in the files actually given; a figure that does not trace, or a true figure under the wrong name, does not survive, and the panel says so instead. The panel is also proved against thirty-three real questions with known correct figures, run whenever the service changes, and must score at least thirty-one of thirty-three to count as working. Months, days and calendar years pass without a source, since they name a period rather than a result. Every answer names the page carrying its figures, so a reader can check the number in context.

## What it costs and how fast it is

The panel runs on the principal's existing Claude subscription through the command line, not a metered pay-per-call key. A metered option exists in the code for later but has never been switched on, and today's version carries no such key. A typical answer takes five to eleven seconds; a repeated context is served from cache and answers faster.

## What it will and will not compute

It can add, subtract, take a share or project a run rate from published figures, but only in the open: it cites every input, calls the result a derived figure, and shows the working under the answer. The service recomputes that working itself before anything is shown, so a derived figure that does not add up is withheld. It will not present a computed figure as a published one, and it will not forecast beyond what the published figures can be combined into. Each question is answered on its own; the conversation stays on screen while the reader moves between reports and is kept only in that browser tab, never on the server; and it cannot see anything outside the published tables, including who runs the company.

When the data does not hold an answer, the panel says exactly this, every time:

**"The published data does not carry that."**
