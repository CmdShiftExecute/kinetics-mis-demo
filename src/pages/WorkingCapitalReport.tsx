import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { count, signedK } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';

/** Where working capital is tied up: receivables, unbilled and inventory, by vertical. */
export default function WorkingCapitalReport() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock message={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
        <TableSkeleton rows={12} />
      </div>
    );
  }
  const { meta, workingCapital, unbilled, inventory, overview: o, definitions, sources } = data;
  const asOf = meta.dataAsOfLabel;
  const cur = meta.currentMonthLabel.split(' ')[0];
  const prev = meta.previousMonthLabel.split(' ')[0];

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <h1 className="display page-title">Working capital</h1>
          <p className="page-sub">Receivables, unbilled and inventory by vertical at {meta.currentMonthLabel} month end</p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          Stock at cost
        </p>
      </div>

      <Strip
        cols={5}
        items={[
          { label: 'Net receivables', value: o.workingCapital.receivablesNet, sub: 'outstanding less provision' },
          { label: 'Unbilled', value: o.workingCapital.unbilled, sub: 'delivered, not invoiced' },
          { label: 'Stock at cost', value: o.workingCapital.inventoryStock },
          { label: 'Free stock over 1 year', value: o.workingCapital.freeStockOverOneYear, sub: 'unallocated and aged', bad: o.workingCapital.freeStockOverOneYear > 0 },
          { label: 'Total tied up', value: o.workingCapital.total, sub: 'receivables plus unbilled plus stock' },
        ]}
      />

      <Section id="by-vertical" title="Working capital by vertical" note="Net receivables, unbilled and stock at cost; goods in transit shown beside, not added." source={sources['rollup.receivables']} asOf={asOf} defs={['workingCapital', 'netToCollect', 'unbilled', 'inTransit']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">Net receivables</th>
                <th scope="col">of which past due</th>
                <th scope="col">Unbilled</th>
                <th scope="col">Stock at cost</th>
                <th scope="col">Free stock over 1 year</th>
                <th scope="col">Total tied up</th>
                <th scope="col">In transit</th>
              </tr>
            </thead>
            <tbody>
              {[...workingCapital.rows].sort((a, b) => b.total - a.total).map((r) => (
                <tr key={r.slug} className="hov">
                  <td>
                    <Link to={`/v/${r.slug}`} className="vlink press">
                      {r.name}
                    </Link>
                  </td>
                  <Num v={r.receivablesNet} />
                  <Num v={r.receivablesPastDue} bad={r.receivablesPastDue > 0} />
                  <Num v={r.unbilled} />
                  <Num v={r.inventoryStock} />
                  <Num v={r.inventoryFreeStockOverOneYear} bad={r.inventoryFreeStockOverOneYear > 0} />
                  <Num v={r.total} />
                  <Num v={r.inTransit} />
                </tr>
              ))}
              <tr className="total">
                <td>{workingCapital.total.name}</td>
                <Num v={workingCapital.total.receivablesNet} />
                <Num v={workingCapital.total.receivablesPastDue} />
                <Num v={workingCapital.total.unbilled} />
                <Num v={workingCapital.total.inventoryStock} />
                <Num v={workingCapital.total.inventoryFreeStockOverOneYear} />
                <Num v={workingCapital.total.total} />
                <Num v={workingCapital.total.inTransit} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="unbilled" title="Unbilled by vertical" note={`Delivered and not yet invoiced: ${prev} to ${cur} month bridge, aged over 60 days since delivery, provision. The name opens the project list.`} source={sources['rollup.unbilled']} asOf={asOf} defs={['unbilled', 'bridge', 'unbilledAging']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">Projects</th>
                <th scope="col">{prev}</th>
                <th scope="col">plus new</th>
                <th scope="col">less cleared</th>
                <th scope="col">plus or less ongoing changes</th>
                <th scope="col">{cur}</th>
                <th scope="col">Aged over 60 days</th>
                <th scope="col">Provision</th>
              </tr>
            </thead>
            <tbody>
              {unbilled.rows.map((r) => (
                <tr key={r.slug} className="hov">
                  <td>
                    <Link to={`/v/${r.slug}#unbilled`} className="vlink press">
                      {r.name}
                    </Link>
                  </td>
                  <Num v={r.projects} f={count} />
                  <Num v={r.previousMonth} />
                  <Num v={r.newProjects} />
                  <Num v={r.clearedProjects} />
                  <Num v={r.ongoingChanges} f={signedK} />
                  <Num v={r.currentMonth} />
                  <Num v={r.agedOver60} bad={r.agedOver60 > 0} />
                  <Num v={r.provision} />
                </tr>
              ))}
              <tr className="total">
                <td>{unbilled.total.name}</td>
                <Num v={unbilled.total.projects} f={count} />
                <Num v={unbilled.total.previousMonth} />
                <Num v={unbilled.total.newProjects} />
                <Num v={unbilled.total.clearedProjects} />
                <Num v={unbilled.total.ongoingChanges} f={signedK} />
                <Num v={unbilled.total.currentMonth} />
                <Num v={unbilled.total.agedOver60} />
                <Num v={unbilled.total.provision} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="inventory" title="Inventory by vertical" note="Stock at cost by age since receipt; provision; stock mapped to purchase orders and free stock." source={sources['rollup.inventory']} asOf={asOf} defs={['inventoryBands', 'inventoryProvision', 'mappedLpo', 'freeStockOverOneYear', 'nonMoving', 'inTransit']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <td className="blank" />
                <th className="group" scope="colgroup" colSpan={5}>
                  Stock by age
                </th>
                <th className="group" scope="colgroup" colSpan={2}>
                  Risk
                </th>
                <th className="group" scope="colgroup" colSpan={4}>
                  Allocation
                </th>
                <td className="blank" />
              </tr>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">Total</th>
                <th scope="col">Under 1 yr</th>
                <th scope="col">1 to 2 yrs</th>
                <th scope="col">2 to 3 yrs</th>
                <th scope="col">Over 3 yrs</th>
                <th scope="col">Non-moving</th>
                <th scope="col">Provision</th>
                <th scope="col">Mapped to POs</th>
                <th scope="col">Mapped over 1 yr</th>
                <th scope="col">Free stock</th>
                <th scope="col">Free over 1 yr</th>
                <th scope="col">In transit</th>
              </tr>
            </thead>
            <tbody>
              {inventory.rows.map((r) => (
                <tr key={r.slug} className="hov">
                  <td>
                    <Link to={`/v/${r.slug}#inventory`} className="vlink press">
                      {r.name}
                    </Link>
                  </td>
                  <Num v={r.totalStock} />
                  <Num v={r.underOneYear} />
                  <Num v={r.oneToTwoYears} />
                  <Num v={r.twoToThreeYears} bad={r.twoToThreeYears > 0} />
                  <Num v={r.overThreeYears} bad={r.overThreeYears > 0} />
                  <Num v={r.nonMovingObsolete} bad={r.nonMovingObsolete > 0} />
                  <Num v={r.provision} />
                  <Num v={r.mappedToPurchaseOrders} />
                  <Num v={r.mappedOverOneYear} />
                  <Num v={r.freeStock} />
                  <Num v={r.freeStockOverOneYear} bad={r.freeStockOverOneYear > 0} />
                  <Num v={r.inTransit} />
                </tr>
              ))}
              <tr className="total">
                <td>{inventory.total.name}</td>
                <Num v={inventory.total.totalStock} />
                <Num v={inventory.total.underOneYear} />
                <Num v={inventory.total.oneToTwoYears} />
                <Num v={inventory.total.twoToThreeYears} />
                <Num v={inventory.total.overThreeYears} />
                <Num v={inventory.total.nonMovingObsolete} />
                <Num v={inventory.total.provision} />
                <Num v={inventory.total.mappedToPurchaseOrders} />
                <Num v={inventory.total.mappedOverOneYear} />
                <Num v={inventory.total.freeStock} />
                <Num v={inventory.total.freeStockOverOneYear} />
                <Num v={inventory.total.inTransit} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
