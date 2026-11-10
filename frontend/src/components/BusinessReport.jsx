import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Info, TrendingUp, AlertTriangle, Target, Printer } from "lucide-react";
import "./BusinessReport.css";

// One report renderer is used by BOTH admin previews and published viewer reports.
// All figures come from a saved/previewed backend snapshot, never invented in JSX.
const PAGES = ["Executive overview", "Analytics & findings", "Predictions & forecasting", "Decisions & recommendations"];
const COLORS = ["#3468dc", "#19a999", "#7366d4", "#53a8eb", "#db9b46", "#d56e7b"];
const friendly = name => String(name || "Business group").replace(/^__insight_|__$/g, "").replace(/_/g, " ");
const amount = (value, digits=1) => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined,{maximumFractionDigits:digits}) : "N/A";
const month = s => String(s || "").slice(0,7);
const readable = item => typeof item === "string" ? item : item?.description || item?.title || "";

function Tile({name,value,sub}) {
  return <div className="bi-tile"><span>{name}</span><strong>{typeof value === "number" ? amount(value,2) : (value ?? "N/A")}</strong>{sub && <small>{sub}</small>}</div>;
}

function Plot({title,subtitle,data,kind="bar",measure="Recorded value",explanation,compact=false}) {
  const [style,setStyle] = useState(kind);
  const shown = (data || []).filter(x=>x && Number.isFinite(Number(x.value))).slice(0,12);
  const total=shown.reduce((sum,x)=>sum+Number(x.value),0);
  const best=[...shown].sort((a,b)=>Number(b.value)-Number(a.value))[0];
  const summary=explanation || (best ? `${best.name ?? best.period} leads the displayed comparison with ${amount(best.value)} ${measure.toLowerCase()}${total>0 ? ` (${(Number(best.value)/total*100).toFixed(1)}% of displayed total)` : ""}. This is an observed association, not proof of cause.` : "The dataset does not contain sufficient information for this chart.");
  const xKey=shown.some(x=>x.period!==undefined) ? "period" : "name";
  return <article className={`bi-card bi-plot ${compact ? "bi-compact" : ""}`}>
    <div className="bi-card-head"><div><h3>{title}</h3><p>{subtitle || measure}</p></div><select aria-label={`Chart style for ${title}`} value={style} onChange={e=>setStyle(e.target.value)}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="donut">Donut</option></select></div>
    {shown.length ? <div className="bi-chart"><ResponsiveContainer width="100%" height="100%">
      {style==="donut" ? <PieChart><Pie data={shown} dataKey="value" nameKey={xKey} innerRadius="43%" outerRadius="70%" paddingAngle={2} label={({percent})=>`${(percent*100).toFixed(0)}%`}>{shown.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(n)=>[amount(n,2),measure]}/></PieChart> : style==="line" ? <LineChart data={shown} margin={{top:22,right:24,bottom:12,left:4}}><CartesianGrid stroke="#e4eaf2" strokeDasharray="3 4" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:10}} interval="preserveStartEnd"/><YAxis tickFormatter={v=>amount(v)} tick={{fontSize:10}} width={55}/><Tooltip formatter={v=>[amount(v,2),measure]}/><Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.7} dot={{r:2}}><LabelList dataKey="value" position="top" formatter={v=>amount(v,0)} style={{fontSize:9,fill:"#486078"}}/></Line></LineChart> : style==="area" ? <AreaChart data={shown} margin={{top:22,right:24,bottom:12,left:4}}><CartesianGrid stroke="#e4eaf2" strokeDasharray="3 4" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:10}} interval="preserveStartEnd"/><YAxis tickFormatter={v=>amount(v)} tick={{fontSize:10}} width={55}/><Tooltip formatter={v=>[amount(v,2),measure]}/><Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={.12} strokeWidth={2.7}><LabelList dataKey="value" position="top" formatter={v=>amount(v,0)} style={{fontSize:9,fill:"#486078"}}/></Area></AreaChart> : <BarChart data={shown} margin={{top:22,right:18,bottom:13,left:4}}><CartesianGrid stroke="#e4eaf2" strokeDasharray="3 4" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:10}} interval="preserveStartEnd"/><YAxis tickFormatter={v=>amount(v)} tick={{fontSize:10}} width={55}/><Tooltip formatter={v=>[amount(v,2),measure]}/><Bar dataKey="value" fill={COLORS[0]} maxBarSize={47} radius={[5,5,0,0]}><LabelList dataKey="value" position="top" formatter={v=>amount(v,0)} style={{fontSize:9,fill:"#486078"}}/></Bar></BarChart>}
    </ResponsiveContainer></div> : <div className="bi-empty">No supported values for this comparison.</div>}
    <details className="bi-chart-explain"><summary><Info size={13}/> Explain this chart</summary><p>{summary}</p></details>
  </article>;
}

function GroupPlots({charts,max=4}) {
  return Object.entries(charts||{}).filter(([,data])=>data?.length).slice(0,max).map(([name,data],i)=><Plot key={name} title={`${friendly(name)} performance`} data={data} measure="Recorded business total" kind={i%3===1 ? "donut":"bar"}/>);
}

export function BusinessAnalyticsSnapshot({payload}) {
  const metrics=(payload?.overview?.metrics||[]).filter(x=>!/missing|duplicate|column/i.test(x.name)).slice(0,4);
  const narrative=payload?.decision?.business_narrative||{};
  return <div className="bi-analytics-snapshot">
    <div className="bi-mini-kpis">{metrics.map((m,i)=><Tile key={i} name={m.name} value={m.value}/>)}</div>
    <div className="bi-grid">{payload?.trend?.length>0 && <Plot title="Historical business performance" subtitle="Observed recorded totals over time" data={payload.trend} kind="area" measure="Recorded monthly total"/>}<GroupPlots charts={payload?.charts} max={3}/></div>
    <article className="bi-card bi-narrative"><h3>Business analysis · what happened and why?</h3><p>{payload?.decision?.executive_summary || "Analysis summary is unavailable for this dataset."}</p>{Object.entries(narrative).filter(([k,v])=>v && !/data_reliability/.test(k)).slice(0,4).map(([key,value])=><p key={key}><strong>{friendly(key)}:</strong> {value}</p>)}<small>These observations are based on the uploaded data; unmeasured underlying causes should not be assumed.</small></article>
  </div>;
}

export default function BusinessReport({payload,title="Retail & E-commerce Business Report"}) {
  const [page,setPage]=useState(0);
  const metrics=(payload?.overview?.metrics||[]).filter(x=>!/missing|duplicate|total columns/i.test(x.name));
  const forecast=payload?.forecast;
  const segments=payload?.segment_forecasts||{};
  const decision=payload?.decision||{};
  const findings=decision.findings||[];
  const q=(payload?.dataset_profile?.row_count || payload?.overview?.rows);
  const prediction=(forecast?.forecasts||[]).map(x=>({period:month(x.period),value:Number(x.forecast)}));
  return <section className="bi-report">
    <header className="bi-report-heading"><div><small>INSIGHT AI · PUBLISHED BUSINESS INTELLIGENCE</small><h2>{title}</h2><p>Page {page+1} of 4 · {PAGES[page]} · {amount(q,0)} analysed records · Source: {payload?.source === "cleaned" ? "approved cleaned dataset" : "uploaded dataset"}</p></div><button className="bi-print" onClick={()=>window.print()}><Printer size={15}/> Print</button></header>
    <nav className="bi-tabs" aria-label="Report pages">{PAGES.map((label,i)=><button key={label} className={page===i ? "active": ""} onClick={()=>setPage(i)}>{String(i+1).padStart(2,"0")} · {label}</button>)}</nav>
    <div className="bi-page" key={page}>
    {page===0 && <>
      <div className="bi-section-title"><span>01 / THE BUSINESS</span><h3>Executive overview</h3><p>A glance at the recorded performance and key company metrics.</p></div>
      <div className="bi-mini-kpis">{metrics.slice(0,5).map((m,i)=><Tile key={i} name={m.name} value={m.value} sub={m.description}/>)}</div>
      <div className="bi-grid">{payload?.trend?.length>0 && <Plot title="Monthly sales trend" subtitle="Actual monthly totals" data={payload.trend} kind="area" measure="Recorded monthly value"/>}<GroupPlots charts={payload?.charts} max={3}/></div>
      <article className="bi-card bi-narrative"><h3>Executive summary</h3><p>{decision.executive_summary || "No supported executive summary is available."}</p></article>
    </>}
    {page===1 && <>
      <div className="bi-section-title"><span>02 / PAST & PRESENT</span><h3>Analytics & findings</h3><p>What happened, which groups led performance, and what the evidence supports.</p></div>
      <BusinessAnalyticsSnapshot payload={payload}/>
      <div className="bi-findings">{findings.slice(0,6).map((f,i)=><article className="bi-card" key={i}><span>FINDING {i+1}</span><h3>{f.title || `Business insight ${i+1}`}</h3><p>{readable(f)}</p>{f.evidence?.product && <small>Product: {f.evidence.product}</small>}{f.evidence?.category && <small>Category: {f.evidence.category}</small>}{f.evidence?.revenue != null && <small>Recorded revenue: {amount(f.evidence.revenue,2)}</small>}</article>)}</div>
    </>}
    {page===2 && <>
      <div className="bi-section-title"><span>03 / THE FUTURE</span><h3>Predictions & forecasting</h3><p>Monthly forecasts are statistical estimates, not guaranteed sales or inventory requirements.</p></div>
      {forecast?.forecasts?.length ? <><div className="bi-mini-kpis">{forecast.forecasts.slice(0,3).map((f,i)=><Tile key={i} name={`${month(f.period)} · predicted ${friendly(forecast.value_column)}`} value={Number(f.forecast)} sub="Forecast monthly total"/>)}<Tile name="Backtest WAPE (lower is better)" value={forecast.backtest_metrics?.[forecast.selected_method]?.wape_percent != null ? `${amount(forecast.backtest_metrics[forecast.selected_method].wape_percent)}%` : "Not measured"} sub={friendly(forecast.selected_method)}/></div><div className="bi-grid"><Plot title="Next three periods" subtitle={`Forecast of monthly total ${friendly(forecast.value_column)}`} data={prediction} kind="line" measure={friendly(forecast.value_column)} explanation="These values are predicted monthly totals of the named measure. If the measure is quantity, units refer to total units sold, not stock on hand. If values repeat, the selected baseline predicts a flat level."/>{Object.entries(segments).slice(0,3).map(([name,group])=>{
          const items=(group?.groups||group?.segments||group?.forecasts||[]); const list=Array.isArray(items) ? items : Object.entries(items).map(([key,val])=>({group:key,forecasts:val?.forecasts||val})); const data=list.map(item=>({name:item.name||item.group||item.segment||item.label,value:Number(item.forecasts?.[0]?.forecast??item.forecast?.forecasts?.[0]?.forecast??item.forecast??item.total_forecast??0)})).filter(x=>x.name && Number.isFinite(x.value));return <Plot key={name} title={`${friendly(name)} demand outlook`} subtitle={`Forecast for first upcoming period · ${friendly(group.value_column||forecast.value_column)}`} data={data} kind="bar" measure="Forecast first-period total"/>;})}</div><article className="bi-card bi-narrative"><h3>What the forecast means</h3><p>Forecasted metric: <strong>{friendly(forecast.value_column)}</strong>. Method: <strong>{friendly(forecast.selected_method)}</strong>. Observed periods: {forecast.observed_periods}. The selected model was compared against historical periods where possible.</p>{(forecast.limitations||[]).slice(0,3).map((text,i)=><p key={i}>{text}</p>)}<p>Do not equate expected sales with purchase orders; verify available inventory, lead time, and uncertainty first.</p></article></> : <article className="bi-card bi-narrative"><h3>Forecast unavailable</h3><p>No trustworthy monthly forecast could be generated from the published dataset. A valid date column and sufficient comparable observations are required.</p></article>}
    </>}
    {page===3 && <>
      <div className="bi-section-title"><span>04 / DECISIONS</span><h3>Decisions & recommendations</h3><p>Prioritized, evidence-based actions with explicit business limitations.</p></div>
      <div className="bi-mini-kpis"><Tile name="Recommendations" value={(decision.recommendations||[]).length} sub="Review feasibility"/><Tile name="Identified risks" value={(decision.risks||[]).length} sub="Monitor exposure"/><Tile name="Recorded findings" value={findings.length} sub="Supporting evidence"/><Tile name="Forecast horizon" value={forecast?.forecasts?.length ? `${forecast.forecasts.length} periods` : "Not available"} sub="Modelled outlook"/></div>
      <div className="bi-decisions"><article className="bi-card"><h3><Target size={17}/> Recommended actions</h3>{(decision.recommendations||[]).length ? <ol>{decision.recommendations.map((it,i)=><li key={i}>{readable(it)}</li>)}</ol> : <p>No specific action is supported by the available report.</p>}</article><article className="bi-card"><h3><AlertTriangle size={17}/> Risks and cautions</h3>{(decision.risks||[]).length ? <ul>{decision.risks.map((it,i)=><li key={i}>{readable(it)}</li>)}</ul> : <p>Monitor seasonal shifts, product availability, costs and forecast error.</p>}</article></div>
      <article className="bi-card bi-narrative"><h3>Four questions, answered</h3><div className="bi-questions"><div><strong>What happened?</strong><p>{decision.business_narrative?.overall_performance || decision.executive_summary || "See recorded business KPIs."}</p></div><div><strong>Why did it happen?</strong><p>{decision.business_narrative?.product_performance || "Compare products, categories and periods; this dataset does not prove causality."}</p></div><div><strong>What will happen?</strong><p>{forecast?.forecasts?.length ? `The selected model forecasts ${amount(forecast.forecasts[0].forecast)} ${friendly(forecast.value_column)} in ${month(forecast.forecasts[0].period)}. This is uncertain.` : "A robust forecast is not available."}</p></div><div><strong>What should we do?</strong><p>{readable(decision.recommendations?.[0]) || "Validate costs, stock, and demand before changing operations."}</p></div></div></article>
    </>}
    </div>
    <footer className="bi-page-nav"><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}><ChevronLeft size={15}/> Previous</button><span>Page {page+1} / 4</span><button onClick={()=>setPage(p=>Math.min(3,p+1))} disabled={page===3}>Next <ChevronRight size={15}/></button></footer>
  </section>;
}
