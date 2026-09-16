# Ask the MIS, in plain words

What happens when someone asks the "Ask the MIS" panel a question, and why the answer can be trusted or is withheld.

## What happens, step by step

1. The reader opens the panel with Ctrl+K, Cmd+K, or the "Ask the MIS" button, and types one question.
2. The service supplies the division roll-up and a compact executive-analysis file covering company-wide engineer rankings, every vertical's monthly results and comparable quarters. It also adds one detailed vertical and engineer file when the question names them.
3. Those files, a fixed set of rules, and a field guide defining every term go to Claude on the principal's own subscription, through the command line, on this server, and no further.
4. The model acts as a management analyst: it compares, ranks and calculates from those figures, explains the finding in plain words and names the report page where the underlying figures appear.
5. The model also writes, under its answer, one citation per figure: the exact place in the data the figure came from. Code with no interest in agreeing follows every citation, confirms the value matches to the digit, confirms the sentence names the right row, and for a "which is highest" question confirms that row really is the extreme of its table.
6. A clean answer and its page link are shown. A draft that fails any check is tried once more and, if it fails again, withheld: the reader is told the draft could not be shown and is pointed at the nearest report.
7. When a requested field or period genuinely does not exist, the model names exactly what is missing and gives the closest useful answer the MIS can support rather than stopping at a generic refusal.

## Why a number cannot be invented

This is enforced mechanically, not merely by instruction. The model is told never to add, average or estimate silently: a computed figure must show its inputs and its working, and the working is recomputed by code before it is shown. After it replies, code with no interest in agreeing follows every citation back to its row, checks the value to the digit, and checks that every number in the prose exists in the files actually given; a figure that does not trace, or a true figure under the wrong name, does not survive, and the panel says so instead. The panel is also proved against thirty-three real questions with known correct figures, run whenever the service changes, and must score at least thirty-one of thirty-three to count as working. Months, days and calendar years pass without a source, since they name a period rather than a result. Every answer names the page carrying its figures, so a reader can check the number in context.

## What it costs and how fast it is

The panel runs on the principal's existing Claude subscription through the command line, not a metered pay-per-call key. A metered option exists in the code for later but has never been switched on, and today's version carries no such key. A typical answer takes five to eleven seconds; a repeated context is served from cache and answers faster.

## What it will and will not compute

It can add, subtract, rank, take a share, compare quarters, calculate month-on-month movement or project a run rate from published figures. It cites every input, labels a new result as calculated and shows the working under the answer. The service recomputes that working itself before anything is shown, so a calculation that does not add up is withheld. For an unqualified "best salesperson" question it uses YTD revenue and also reports GM and budget performance; for "best vertical" it uses revenue variance against budget for the requested period. Each question is answered on its own; the conversation stays on screen while the reader moves between reports and is kept only in that browser tab, never on the server.

When the requested field truly does not exist, the panel begins with this and then explains the missing field and closest available analysis:

**"The MIS does not contain that specific information."**
