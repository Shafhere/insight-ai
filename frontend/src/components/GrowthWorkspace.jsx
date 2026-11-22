import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import "./GrowthWorkspace.css";
import { workspaceRequest, uploadDataset } from "../services/api";
const number = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });

export function Outlook({ result }) {
  if (!result?.forecasts?.length)
    return <p>{result?.reason || "This snapshot has no forecast."}</p>;
  const data = [...(result.history || []).slice(-36), ...result.forecasts].map(
    (r) => ({ ...r, period: r.period.slice(0, 7) }),
  );
  const last = result.forecasts.at(-1);
  return (
    <article className="analytics-panel growth-summary">
      <h3>Monthly outlook · {result.value_column}</h3>
      <p>
        By {last.period.slice(0, 7)}, the estimated monthly total is{" "}
        <strong>{number(last.forecast)}</strong>. The solid line shows observed
        totals. The dashed line shows estimates.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" minTickGap={45} />
          <YAxis width={76} />
          <Tooltip />
          <Line dataKey="actual" stroke="#368dc9" dot={false} />
          <Line
            dataKey="forecast"
            stroke="#169679"
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="analytics-metric-grid">
        {[
          ["Last observed", result.history?.at(-1)?.actual],
          ["Next month", result.forecasts[0].forecast],
          [
            "Holdout MAE",
            result.backtest_metrics?.[result.selected_method]?.mae,
          ],
        ].map(([k, v]) => (
          <div className="analytics-metric-card" key={k}>
            <span>{k}</span>
            <strong>{number(v)}</strong>
          </div>
        ))}
      </div>
      <details>
        <summary>Model evaluation</summary>
        <p>
          Each candidate was evaluated on the latest {result.backtest_periods}{" "}
          observations. Lowest mean absolute error wins.
        </p>
        {Object.entries(result.backtest_metrics || {}).map(([k, v]) => (
          <p key={k}>
            {k.replaceAll("_", " ")} · MAE {number(v.mae)} · RMSE{" "}
            {number(v.rmse)} · WAPE {number(v.wape_percent)}%
          </p>
        ))}
      </details>
      <p>
        {result.selected_method.replaceAll("_", " ")} ·{" "}
        {result.observed_periods} months observed · holdout MAE{" "}
        {number(result.backtest_metrics?.[result.selected_method]?.mae)} in{" "}
        {result.value_column}. Long-range estimates assume historical patterns
        continue.
      </p>
    </article>
  );
}

export function GrowthSummary({ data }) {
  if (!data?.customers)
    return (
      <p>
        {data?.reason ||
          "Customer purchase history is unavailable in this snapshot."}
      </p>
    );
  return (
    <section className="analytics-panel growth-summary">
      <h3>Customer growth · {data.as_of}</h3>
      <p>{data.summary}</p>
      <div className="analytics-metric-grid">
        {[
          ["Customers", data.customers],
          ["Repeat purchase rate", data.repeat_pct + "%"],
          ["Overdue", data.overdue],
          ["Returned after a gap", data.recovered],
        ].map(([k, v]) => (
          <div className="analytics-metric-card" key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data.segments}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" name="Customers" fill="#4985ca" />
        </BarChart>
      </ResponsiveContainer>
      {data.feedback && (
        <p>
          Average feedback {data.feedback.average}/5 from{" "}
          {data.feedback.ratings} ratings. Low-rating topics:{" "}
          {Object.entries(data.feedback.low_rating_topics)
            .map(([k, v]) => k + " (" + v + ")")
            .join(", ") || "None recorded"}
          .
        </p>
      )}
      {data.engagement && (
        <p>
          {data.engagement.contacted} customers marked contacted ·{" "}
          {data.engagement.later_purchases} purchased on a later date. Timing
          alone cannot establish that outreach caused a purchase.
        </p>
      )}
      <details>
        <summary>Customer segments and evidence coverage</summary>
        <p>
          {Object.entries(data.rfm_segments || {})
            .map(([k, v]) => k + ": " + v)
            .join(" · ")}
        </p>
        <p>
          {data.identified_lines} identified sales lines of {data.source_lines}.
          Orders counted by {data.order_basis}.
        </p>
        {data.feedback && (
          <>
            <p>
              Ratings:{" "}
              {Object.entries(data.feedback.distribution)
                .map(([k, v]) => k + " stars (" + v + ")")
                .join(", ")}
            </p>
            <p>
              Recent monthly average ratings:{" "}
              {Object.entries(data.feedback.trend || {})
                .slice(-6)
                .map(([k, v]) => k + " (" + v + ")")
                .join(", ")}
            </p>
          </>
        )}
      </details>
      <p>
        Overdue means the latest gap exceeds 1.5 times the median interval
        between visits. The estimate uses each customer’s own visit dates.
        One-time shoppers have no personal interval yet. A late visit alone
        cannot explain why a customer stayed away.
      </p>
    </section>
  );
}

export default function Workspace({ id, mode, activate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [readiness, setReadiness] = useState(null),
    [busy, setBusy] = useState(false),
    [lookup, setLookup] = useState(""),
    [left, setLeft] = useState(""),
    [right, setRight] = useState(""),
    [review, setReview] = useState(null),
    [metric, setMetric] = useState(""),
    [horizon, setHorizon] = useState(3),
    [filter, setFilter] = useState("Overdue"),
    [draft, setDraft] = useState(""),
    [page, setPage] = useState(0);
  const modeling = mode === "Data Modeling",
    growth = mode === "Customer Growth";
  useEffect(() => {
    let live = true;
    if (modeling)
      workspaceRequest(id, "readiness")
        .then((value) => live && setReadiness(value))
        .catch((e) => live && setError(e.message));
    if (!modeling)
      workspaceRequest(id, growth ? "growth" : "outlook")
        .then((r) => {
          if (live) {
            setData(r);
            setHorizon(r.forecasts?.length || 3);
            setMetric(r.value_column || "");
          }
        })
        .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, mode]);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function fileChanged(file) {
    if (!file) return;
    await run(async () => {
      const uploaded = await uploadDataset(file),
        other = uploaded.dataset.dataset_id;
      if (growth) {
        await workspaceRequest(id, "customer-source/" + other, "PUT");
        setData(await workspaceRequest(id, "growth"));
        setPage(0);
        setDraft("");
        return;
      }
      const res = await workspaceRequest(id, "model", "POST", {
        lookup: other,
      });
      setLookup(other);
      setData(res);
      setLeft(res.candidates[0]?.left || res.left_columns[0]);
      setRight(res.candidates[0]?.right || res.right_columns[0]);
      setReview(null);
    });
  }
  const rows = (data?.rows || []).filter(
    (r) => filter === "All" || r.segment === filter || r.rfm === filter,
  );
  return (
    <section className="analytics-page growth-workspace">
      <header className="welcome-section">
        <div>
          <h2>{mode}</h2>
          <p>
            {modeling
              ? "Enrich each sales row with attributes from a lookup table."
              : growth
                ? "Understand repeat visits and review customers who may benefit from a personal follow-up."
                : "Estimate future monthly sales or units from the active dataset."}
          </p>
        </div>
      </header>
      {modeling && readiness && (
        <details className="analytics-panel">
          <summary>Dataset readiness and active relationship</summary>
          {Object.entries(readiness).map(([feature, detail]) => (
            <p key={feature}>
              <strong>{feature}</strong> · {detail}
            </p>
          ))}
        </details>
      )}
      {!modeling && !data && !error && (
        <p role="status">Reading the active dataset…</p>
      )}
      {error && (
        <p role="alert" className="notice error-notice">
          {error}
        </p>
      )}
      {(modeling || growth) && (
        <label className="analytics-panel">
          {modeling
            ? "Upload a customer or product lookup"
            : "Optional · use a separate dated customer purchase history"}{" "}
          <input
            type="file"
            accept=".csv,.xlsx,.json"
            disabled={busy}
            onChange={(e) => fileChanged(e.target.files[0])}
          />
        </label>
      )}
      {growth && (
        <label className="analytics-panel">
          Optional · upload customer feedback{" "}
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file)
                run(async () => {
                  const up = await uploadDataset(file);
                  await workspaceRequest(
                    id,
                    "feedback/" + up.dataset.dataset_id,
                    "PUT",
                  );
                  setData(await workspaceRequest(id, "growth"));
                });
            }}
          />
        </label>
      )}
      {busy && <p role="status">Processing…</p>}
      {modeling && lookup && (
        <section className="analytics-panel">
          <h3>Review relationship</h3>
          <div className="modeling-roadmap">
            <div>
              <strong>{data.sales_name}</strong>
              <span>
                {number(data.sales_rows)} rows · {data.left_columns.length}{" "}
                columns
              </span>
            </div>
            <span>→</span>
            <div>
              <strong>{data.lookup_name}</strong>
              <span>
                {number(data.lookup_rows)} rows · {data.right_columns.length}{" "}
                columns
              </span>
            </div>
          </div>
          <p>
            {data.candidates.length} suggested matches. Choose the sales foreign
            key and the lookup primary key.
          </p>
          {[
            ["Sales key", left, setLeft, data.left_columns],
            ["Lookup key", right, setRight, data.right_columns],
          ].map(([label, val, set, cols]) => (
            <label key={label}>
              {label}{" "}
              <select
                value={val}
                onChange={(e) => {
                  set(e.target.value);
                  setReview(null);
                }}
              >
                {cols.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>{" "}
            </label>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              run(async () =>
                setReview(
                  await workspaceRequest(id, "model", "POST", {
                    lookup,
                    left,
                    right,
                  }),
                ),
              )
            }
          >
            Preview join
          </button>
          {review && (
            <>
              {review.preview && (
                <details open>
                  <summary>
                    Combined preview · {number(review.output_rows)} rows
                  </summary>
                  <div className="columns-table-wrapper">
                    <table className="columns-table">
                      <thead>
                        <tr>
                          {Object.keys(review.preview[0] || {}).map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {review.preview.map((row, i) => (
                          <tr key={i}>
                            {Object.entries(row).map(([c, v]) => (
                              <td key={c}>{v ?? "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              <p>
                {review.matched} sales rows matched · {review.unmatched}{" "}
                unmatched · {review.duplicate_lookup_rows} lookup rows with
                repeated keys · {review.missing_lookup_keys} missing keys.
              </p>
              <button
                disabled={busy || !review.safe}
                onClick={() =>
                  run(async () =>
                    activate(
                      await workspaceRequest(id, "model", "POST", {
                        lookup,
                        left,
                        right,
                        apply: true,
                      }),
                    ),
                  )
                }
              >
                Approve and use modeled sales
              </button>
            </>
          )}
        </section>
      )}
      {!modeling && !growth && (
        <>
          <section className="analytics-panel">
            <label>
              Measure{" "}
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {data?.metrics?.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>{" "}
            <label>
              Planning horizon{" "}
              <select
                value={horizon}
                onChange={(e) => setHorizon(+e.target.value)}
              >
                {[3, 6, 12, 36, 48].map((v) => (
                  <option key={v} value={v}>
                    {v} months
                  </option>
                ))}
              </select>
            </label>{" "}
            <button
              disabled={busy}
              onClick={() =>
                run(async () =>
                  setData(
                    await workspaceRequest(
                      id,
                      "outlook/" +
                        horizon +
                        "?metric=" +
                        encodeURIComponent(metric),
                      "PUT",
                    ),
                  ),
                )
              }
            >
              Apply to forecast and report
            </button>
          </section>
          {data && <Outlook result={data} />}
        </>
      )}
      {growth && (
        <>
          {data && <GrowthSummary data={data} />}
          {data?.rows && (
            <article className="analytics-panel">
              <h3>Customer follow-up</h3>
              <label>
                Segment{" "}
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  {[
                    "Overdue",
                    "Returning",
                    "First purchase",
                    "High value",
                    "Loyal",
                    "All",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <div className="columns-table-wrapper">
                <table className="columns-table">
                  <thead>
                    <tr>
                      {[
                        "Customer",
                        "Last visit",
                        "Orders",
                        "Spend",
                        "Usual gap (days)",
                        "Preferred category",
                        "Follow-up",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(page * 25, page * 25 + 25).map((r) => (
                      <tr key={r.customer}>
                        <td>
                          <details>
                            <summary>
                              {r.name} · {r.rfm}
                            </summary>
                            <p>
                              {r.customer} · First purchase {r.first_purchase} ·{" "}
                              {r.days_since} days since last purchase · Average
                              order {number(r.average_order)}
                            </p>
                            <p>
                              Orders by year:{" "}
                              {Object.entries(r.annual)
                                .map(([y, n]) => y + " (" + n + ")")
                                .join(", ")}
                            </p>
                            <p>
                              {r.seasonal.join(" · ")} · Stores:{" "}
                              {r.stores.join(", ")}
                            </p>
                            <p>Marketing permission: {r.permission}</p>
                          </details>
                        </td>
                        <td>{r.last_purchase}</td>
                        <td>{r.orders}</td>
                        <td>{number(r.spend)}</td>
                        <td>{number(r.cadence_days)}</td>
                        <td>{r.interest || "—"}</td>
                        <td>
                          <button
                            onClick={() =>
                              setDraft(
                                "Hi " +
                                  r.name +
                                  ", thank you for shopping with us. Would you like to hear about " +
                                  (r.interest || "our latest collection") +
                                  "? We would also love to hear how your last visit went.",
                              )
                            }
                          >
                            Draft message
                          </button>
                          <select
                            aria-label={"Follow-up status for " + r.name}
                            value={r.status}
                            disabled={busy}
                            onChange={(e) => {
                              const status = e.target.value;
                              run(async () => {
                                await workspaceRequest(
                                  id,
                                  "follow-up",
                                  "POST",
                                  { customer: r.customer, status },
                                );
                                setData(await workspaceRequest(id, "growth"));
                              });
                            }}
                          >
                            <option value="">Set follow-up status</option>
                            {[
                              "Follow-up planned",
                              "Contacted",
                              "No response",
                              "Customer responded",
                              "Customer purchased again",
                              "Closed",
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {rows.length} customers · Page {page + 1}{" "}
                <button disabled={!page} onClick={() => setPage(page - 1)}>
                  Previous
                </button>{" "}
                <button
                  disabled={(page + 1) * 25 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </p>
              {draft && (
                <label>
                  Review your draft and confirm contact permission before use.{" "}
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button onClick={() => navigator.clipboard.writeText(draft)}>
                    Copy draft
                  </button>
                </label>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}
