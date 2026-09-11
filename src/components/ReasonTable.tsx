import type { ReasonSplit } from "../../data/schema";
import { k, pct } from "../lib/format";
import { REASON_LABELS } from "../lib/reasons";

/** Reasons for non-collection: three buckets that partition total outstanding, the third shown split. */
export function ReasonTable({
  reasons,
  total,
}: {
  reasons: ReasonSplit;
  total: number;
}) {
  const share = (v: number) => pct(total ? (v / total) * 100 : 0, 0);
  return (
    <div className="scroll-x">
      <table className="mis compact reasons">
        <thead>
          <tr>
            <th scope="col">Reason for non-collection</th>
            <th scope="col">Outstanding</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{REASON_LABELS.internalGroup}</th>
            <td className="num">{k(reasons.internalGroup)}</td>
            <td className="num">{share(reasons.internalGroup)}</td>
          </tr>
          <tr>
            <th scope="row">{REASON_LABELS.followUpNoResponse}</th>
            <td className="num">{k(reasons.followUpNoResponse)}</td>
            <td className="num">{share(reasons.followUpNoResponse)}</td>
          </tr>
          <tr>
            <th scope="row">{REASON_LABELS.disputesAndNotDue}</th>
            <td className="num">{k(reasons.disputesAndNotDue)}</td>
            <td className="num">{share(reasons.disputesAndNotDue)}</td>
          </tr>
          <tr className="indent">
            <th scope="row">of which disputed</th>
            <td className="num">{k(reasons.disputed)}</td>
            <td className="num">{share(reasons.disputed)}</td>
          </tr>
          <tr className="indent">
            <th scope="row">of which within terms, nothing past due</th>
            <td className="num">{k(reasons.withinTerms)}</td>
            <td className="num">{share(reasons.withinTerms)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Total outstanding</th>
            <td className="num">{k(total)}</td>
            <td className="num">{share(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
