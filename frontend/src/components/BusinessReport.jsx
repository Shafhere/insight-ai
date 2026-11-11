import { useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { AlertTriangle, Info, Printer, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import './BusinessReport.css';

// Both admin and viewer render this component from the SAME saved report snapshot.
// All business numbers below come from Python; never create values in the browser.
const PAGES = ['Executive overview', 'Sales & customers', 'Inventory & placement', 'Action plan'];
const COLORS = ['#3974e8','#18a89b','#7466cc','#e7a044','#e07783','#60a9e1'];
const fmt = (v,d=0) => v == null || !Number.isFinite(Number(v)) ? 'Not available' : Number(v).toLocaleString(undefined,{maximumFractionDigits:d});
const compact = (v) => v==null || !Number.isFinite(Number(v)) ? 'N/A' : Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(Number(v));
const label = s => String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const details = (v) => typeof v === 'string' ? v : v?.description || v?.action || v?.title || '';
const metric = (name,value,unit='',note='') => ({name,value:value==null ? 'N/A' : `${fmt(value,unit==='%'?1:0)}${unit==='%'?'%':''}`,note});

function Kpis({items}) {
  return <div className="bi-mini-kpis">{items.map((m,i)=><div className="bi-tile" key={i}><span>{m.name}</span><strong>{m.value}</strong><small>{m.note || 'From uploaded transactions'}</small></div>)}</div>;
}
function Plot({title,subtitle,data=[],kind='bar',unit='',explanation=''}) {
  const [mode,setMode] = useState(kind);
  const shown=(data||[]).filter(x=>x && x.value!=null && Number.isFinite(Number(x.value))).slice(0,12);
  const xKey = shown[0]?.period != null ? 'period':'name';
  const top=[...shown].sort((a,b)=>b.value-a.value)[0];
  const text=explanation || (top ? `Highest displayed ${title.toLowerCase()}: ${top[xKey]} with ${fmt(top.value,2)} ${unit || 'recorded units'}. This is historical evidence, not a causal explanation.` : 'The source file does not contain sufficient usable values for this chart.');
  return <article className="bi-card bi-plot"><div className="bi-card-head"><div><h3>{title}</h3><p>{subtitle}</p></div><select value={mode} aria-label={`${title} chart type`} onChange={e=>setMode(e.target.value)}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="donut">Donut</option></select></div>
    {shown.length ? <div className="bi-chart"><ResponsiveContainer width="100%" height="100%">{mode==='donut' ? <PieChart><Pie data={shown} dataKey="value" nameKey={xKey} cx="50%" cy="50%" innerRadius="44%" outerRadius="70%" label={({percent})=>`${(percent*100).toFixed(0)}%`}>{shown.map((_,i)=><Cell fill={COLORS[i%COLORS.length]} key={i}/>)}</Pie><Tooltip formatter={v=>[fmt(v,2),unit]}/></PieChart> : mode==='line' ? <LineChart data={shown} margin={{top:25,right:20,bottom:7,left:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} interval="preserveStartEnd" tick={{fontSize:10}}/><YAxis tickFormatter={compact} width={49} tick={{fontSize:10}}/><Tooltip formatter={v=>[fmt(v,2),unit]}/><Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.6}><LabelList dataKey="value" position="top" formatter={compact} style={{fontSize:9,fill:'#6681a3'}}/></Line></LineChart> : mode==='area' ? <AreaChart data={shown} margin={{top:25,right:20,bottom:7,left:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} interval="preserveStartEnd" tick={{fontSize:10}}/><YAxis tickFormatter={compact} width={49} tick={{fontSize:10}}/><Tooltip formatter={v=>[fmt(v,2),unit]}/><Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={.13} strokeWidth={2.5}><LabelList dataKey="value" position="top" formatter={compact} style={{fontSize:9,fill:'#6681a3'}}/></Area></AreaChart> : <BarChart data={shown} margin={{top:25,right:20,bottom:7,left:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} interval="preserveStartEnd" tick={{fontSize:10}}/><YAxis tickFormatter={compact} width={49} tick={{fontSize:10}}/><Tooltip formatter={v=>[fmt(v,2),unit]}/><Bar dataKey="value" fill={COLORS[0]} maxBarSize={47} radius={[5,5,0,0]}><LabelList dataKey="value" position="top" formatter={compact} style={{fontSize:9,fill:'#6681a3'}}/></Bar></BarChart>}</ResponsiveContainer></div> : <div className="bi-empty">Not available in this dataset</div>}
    <details className="bi-chart-explain"><summary><Info size={13}/> Explain this chart</summary><p>{text}</p></details>
  </article>;
}
// Choose charts from data actually uploaded, rather than rendering empty retail-only cards.
// The value unit always follows the chosen measure (sales, units or record counts).
function AvailablePlot({charts={}, options=[], kind='bar'}) {
  const matched=options.find(([key])=>Array.isArray(charts[key]) && charts[key].some(row=>row.value!=null));
  if (!matched) return null;
  const [key,title,subtitle,unit]=matched;
  return <Plot title={title} subtitle={subtitle||`Measured from the uploaded dataset`} data={charts[key]} kind={kind} unit={unit||''}/>;
}
function SalesMix({charts={}}) {
  return <div className="bi-grid">
    <AvailablePlot charts={charts} kind="area" options={[["monthly_revenue","Monthly revenue","Recorded revenue by month","sales"],["weekday_sales","Revenue by weekday","Recorded revenue by weekday","sales"],["product_units","Units sold by product","Quantity across products","units"],["category_records","Records by category","Counts of transaction lines","records"]]}/>
    <AvailablePlot charts={charts} options={[["branch_sales","Sales by location","Store or region ranking","sales"],["state_sales","Sales by state","Recorded location sales","sales"],["city_sales","Sales by city","Recorded location sales","sales"],["channel_sales","Sales by channel","Revenue by channel","sales"],["branch_records","Records by location","Transaction line counts","records"]]}/>
    <AvailablePlot charts={charts} options={[["product_sales","Top products by revenue","Recorded product sales","sales"],["product_units","Top products by units","Total units sold","units"],["product_records","Product transactions","Transaction-line counts","records"]]}/>
    <AvailablePlot charts={charts} kind="donut" options={[["category_sales","Category revenue","Category contribution to sales","sales"],["subcategory_sales","Subcategory revenue","Revenue by subcategory","sales"],["channel_sales","Channel revenue","Sales channel contribution","sales"],["payment_sales","Payment method revenue","Recorded sales","sales"],["category_units","Units by category","Recorded unit volume","units"],["category_records","Category transactions","Transaction-line counts","records"]]}/>
  </div>;
}
function HourHeatmap({data=[]}) {
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const cells=new Map(data.map(x=>[`${x.day}-${x.hour}`,x.value]));
  const peak=Math.max(1,...data.map(x=>x.value));
  const hours=Array.from({length:14},(_,i)=>i+9);
  return <article className="bi-card bi-heatmap"><h3>Shopping activity by weekday and hour</h3><p className="bi-caption">Transaction-line counts, not measured foot traffic · darker = busier</p>
    {data.length?<div className="bi-heatmap-scroll"><div className="bi-heatmap-grid" style={{gridTemplateColumns:`65px repeat(${hours.length},minmax(21px,1fr))`}}><span></span>{hours.map(h=><span key={h}>{h}</span>)}{days.map(day=><div className="bi-heatmap-row" key={day} style={{display:'contents'}}><strong>{day.slice(0,3)}</strong>{hours.map(hour=>{const n=cells.get(`${day}-${hour}`)||0;return <span key={hour} title={`${day} ${hour}:00: ${n} transaction lines`} className="bi-heatmap-dot" style={{background:`rgba(52,104,220,${Math.max(.07,n/peak)})`}}>{n>0?n:''}</span>})}</div>)}</div></div>:<p className="bi-empty-short">An hour or date field is needed for this analysis.</p>}
  </article>;
}
function MarginScatter({data=[]}) {
  const points=data.filter(x=>x.sales!=null && x.value!=null).map(x=>({...x,x:x.sales,y:x.value}));
  return <article className="bi-card bi-plot"><div className="bi-card-head"><div><h3>Sales versus category profit margin</h3><p>Each point represents one category; x = sales, y = margin %</p></div></div>{points.length?<div className="bi-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:15,right:18,left:0,bottom:12}}><CartesianGrid strokeDasharray="3 4"/><XAxis type="number" dataKey="x" tickFormatter={compact} name="Sales" tick={{fontSize:10}}/><YAxis type="number" dataKey="y" name="Margin %" tick={{fontSize:10}} width={45}/><ZAxis range={[55,55]}/><Tooltip cursor={{strokeDasharray:'3 3'}} formatter={fmt}/><Scatter name="Categories" data={points} fill={COLORS[1]}/></ScatterChart></ResponsiveContainer></div>:<div className="bi-empty">Category, revenue and purchase cost fields are required.</div>}<details className="bi-chart-explain"><summary><Info size={13}/> Explain this chart</summary><p>High sales with low margin needs attention, but this comparison alone cannot prove the reason. Hover each point to inspect its recorded figures.</p></details></article>;
}

function TableCard({title,columns=[],rows=[],note='',empty='Required data not available'}) {
  return <article className="bi-card bi-table-card"><h3>{title}</h3>{note&&<p className="bi-caption">{note}</p>}{rows.length?<div className="bi-table-scroll"><table><thead><tr>{columns.map(c=><th key={c[0]}>{c[1]}</th>)}</tr></thead><tbody>{rows.slice(0,8).map((r,i)=><tr key={i}>{columns.map(c=><td key={c[0]}>{r[c[0]] == null ? '—' : typeof r[c[0]]==='number'?fmt(r[c[0]],2):r[c[0]]}</td>)}</tr>)}</tbody></table></div>:<p className="bi-empty-short">{empty}</p>}</article>;
}
function SectionHeading({n,title,desc}) {return <div className="bi-section-title"><span>{n} / RETAIL INTELLIGENCE</span><h3>{title}</h3><p>{desc}</p></div>}
function Note({children,title='Business interpretation'}) {return <article className="bi-card bi-narrative"><h3>{title}</h3>{children}</article>}
function FilterlessNote({retail}) {return <small className="bi-disclaimer">This is a frozen report snapshot of the {retail?.scope?.records?.toLocaleString() ?? 'available'} records. Comparisons use recorded evidence; no inventory events, targets, traffic, forecast or financial uplift are assumed when missing.</small>}

function RetailFilters({payload,selection,setSelection}) {
  const groups=payload?.retail_filters||{};
  if (!Object.keys(groups).some(k=>Object.keys(groups[k]||{}).length)) return null;
  return <div className="bi-filterbar"><label>View business results for <select value={selection} onChange={e=>setSelection(e.target.value)}><option value="">All records</option>{Object.entries(groups).flatMap(([kind,values])=>Object.keys(values||{}).map(name=><option key={`${kind}:${name}`} value={`${kind}:${name}`}>{label(kind)} · {name}</option>))}</select></label><small>KPIs and charts update together; one dimension at a time.</small></div>;
}
function selectedRetail(payload,selection) {
  if (!selection) return payload?.retail||{};
  const [dimension,...rest]=selection.split(':');
  return payload?.retail_filters?.[dimension]?.[rest.join(':')] || payload?.retail || {};
}

// Compact historical dashboard shown in admin Analytics and published viewer Analytics.
export function BusinessAnalyticsSnapshot({payload,hideFilters=false,filterSelection,changeFilter}) {
  const [localSelection,setLocalSelection]=useState('');
  const selection=filterSelection ?? localSelection;
  const setSelection=changeFilter || setLocalSelection;
  const r=selectedRetail(payload,selection);const k=r.kpis||{};const ch=r.charts||{};
  return <div className="bi-analytics-snapshot">
    {!hideFilters && <RetailFilters payload={payload} selection={selection} setSelection={setSelection}/>}
    <Kpis items={[metric('Net sales',k.net_sales),metric('Gross profit',k.gross_profit),metric('Profit margin',k.gross_margin_pct,'%'),metric('Transactions',k.transaction_count),metric('Average bill value',k.average_transaction_value)]}/>
    <SalesMix charts={ch}/>
    <Note title="What happened? · Business snapshot"><p>{r.insights?.slice(0,3).join(' ') || payload?.decision?.executive_summary || 'Revenue and category summaries need identifiable sales fields.'}</p><p>Sales comparisons reveal where recorded results differed. To establish why, the company should review price changes, stock availability, campaigns and other evidence outside this transaction file.</p><FilterlessNote retail={r}/></Note>
  </div>;
}

export default function BusinessReport({payload,title='Retail & E-commerce Business Report'}) {
  const [page,setPage] = useState(0);
  const [selection,setSelection]=useState('');
  const r=selectedRetail(payload,selection),k=r.kpis||{},sc=r.scope||{},ch=r.charts||{},tb=r.tables||{};
  const rawDecision=payload?.decision||{};
  return <section className="bi-report">
    <header className="bi-report-heading"><div><small>INSIGHT AI · DATA-GROUNDED BUSINESS REPORT</small><h2>{title}</h2><p>Page {page+1} / 4 · {PAGES[page]} · {fmt(sc.records)} source rows · {payload?.source==='cleaned'?'Approved cleaned data':'Uploaded data'}</p></div><button className="bi-print" onClick={()=>window.print()}><Printer size={15}/> Print page</button></header>
    <nav className="bi-tabs" aria-label="Report sections">{PAGES.map((name,i)=><button className={page===i?'active':''} key={i} onClick={()=>setPage(i)}>{String(i+1).padStart(2,'0')} · {name}</button>)}</nav>
    <RetailFilters payload={payload} selection={selection} setSelection={setSelection}/>
    <div className="bi-page" key={page}>
      {page===0 && <><SectionHeading n="01" title="Executive overview" desc="What business activity is covered, and what do the numbers show?"/>
        <div className="bi-scope"><span><strong>Period</strong>{sc.first_date&&sc.last_date?`${sc.first_date} — ${sc.last_date}`:'Date unavailable'}</span><span><strong>Records</strong>{fmt(sc.records)}</span><span><strong>Active products</strong>{fmt(sc.active_skus)}</span><span><strong>Missing cells / duplicates</strong>{fmt(sc.missing_cells)} / {fmt(sc.duplicate_rows)}</span></div>
        <Kpis items={[metric('Net sales',k.net_sales),metric('Gross profit',k.gross_profit),metric('Gross margin',k.gross_margin_pct,'%'),metric('Transactions',k.transaction_count),metric('Average transaction',k.average_transaction_value)]}/>
        <SalesMix charts={ch}/>
        <Note title="Executive takeaways"><p>{r.insights?.slice(0,3).join(' ')||'Insufficient sales fields for ranked takeaways.'}</p><p>Dataset scope: {fmt(sc.records)} records, {fmt(sc.active_skus)} identifiable SKUs, {fmt(sc.locations)} locations. {sc.data_note}</p></Note></>}
      {page===1 && <><SectionHeading n="02" title="Sales & customer diagnosis" desc="What sold, when did it sell, and where are the differences?"/>
        <Kpis items={[metric('Units sold',k.units_sold),metric('Units per bill',k.units_per_transaction),metric('Customers',k.unique_customers),metric('Discount value',k.discount_total),metric('Recent monthly growth',k.sales_growth_pct,'%')]}/>
        <div className="bi-grid">
          <AvailablePlot charts={ch} options={[["category_sales","Sales by category","Historical category revenue","sales"],["subcategory_sales","Sales by subcategory","Recorded subcategory revenue","sales"],["category_units","Units by category","Sold quantity","units"],["category_records","Category activity","Transaction-line counts","records"]]}/>
          {ch.category_margin?.some(x=>x.value!=null && x.sales!=null) ? <MarginScatter data={ch.category_margin}/> : <AvailablePlot charts={ch} options={[["product_sales","Product revenue ranking","Recorded product sales","sales"],["product_units","Product volume ranking","Recorded units","units"],["product_records","Product activity","Transaction-line counts","records"]]}/>}
          <AvailablePlot charts={ch} options={[["brand_sales","Revenue by brand","Brand performance","sales"],["subcategory_sales","Subcategory sales","Product mix","sales"],["state_sales","Revenue by state","Geographic contribution","sales"],["city_sales","Revenue by city","Geographic contribution","sales"],["product_units","Units by product","Product quantities","units"]]}/>
          <AvailablePlot charts={ch} kind="donut" options={[["promotion_sales","Discounted vs full-price","Observed revenue; not proof of promotional uplift","sales"],["channel_sales","Sales by channel","Revenue by channel","sales"],["payment_sales","Sales by payment method","Recorded revenue","sales"],["category_records","Category mix","Transaction-line counts","records"]]}/>
          <AvailablePlot charts={ch} options={[["channel_sales","Sales by channel","Revenue by checkout channel","sales"],["payment_sales","Sales by payment method","Recorded checkout revenue","sales"],["state_sales","Sales by state","Location comparison","sales"],["weekday_sales","Sales by weekday","Day-of-week comparison","sales"],["channel_records","Orders by channel","Transaction-line counts","records"]]}/>
          <AvailablePlot charts={ch} options={[["product_units","Units sold by product","Total recorded units sold","units"],["category_units","Units sold by category","Total recorded units sold","units"],["branch_transactions","Bills by location","Unique transaction counts","bills"],["product_records","Product activity","Transaction-line counts","records"]]}/>
        </div>
        {ch.hour_heatmap?.length ? <HourHeatmap data={ch.hour_heatmap}/> : <AvailablePlot charts={ch} options={[["weekday_sales","Revenue by weekday","Which days recorded higher sales","sales"],["monthly_revenue","Monthly sales trend","Recorded historical revenue","sales"],["branch_transactions","Bills by location","Recorded unique transactions","bills"]]}/>}
        {tb.basket_pairs?.length ? <TableCard title="Frequently bought together" note="Items on the same bill; candidate bundles, not proven uplift" columns={[["items","Product pair"],["orders_together","Bills together"]]} rows={tb.basket_pairs}/> : <Note title="Product mix insight"><p>{ch.product_sales?.[0] ? `${ch.product_sales[0].name} generated the highest recorded product sales among the displayed products.` : ch.product_units?.[0] ? `${ch.product_units[0].name} has the highest observed unit sales.` : 'Product combinations require multiple different products within one transaction ID.'} Basket analysis cannot identify bundles when each bill contains only one line.</p></Note>}
        <Note title="Why did results differ?"><p>{r.insights?.slice(0,4).join(' ')||'Dataset does not include enough ranked product and category measures.'}</p><p>Category, time, customer and discount splits show associations. Revenue differences alone cannot establish causality or customer satisfaction. The report does not manufacture conversion or footfall figures.</p></Note></>}
      {page===2 && <><SectionHeading n="03" title={r.available?.stock ? "Inventory & placement efficiency" : "Products, locations & business operations"} desc={r.available?.stock ? "Which SKUs may need review and which locations drive recorded sales?" : "This dataset has no inventory snapshot. Use the available product, store, customer and sales evidence instead."}/>
        {r.available?.stock ? <>
          <Kpis items={[metric('Latest stock units',k.current_stock_units),metric('Low-stock SKU/locations',k.low_stock_skus),metric('Units sold',k.units_sold),metric('Gross profit',k.gross_profit)]}/>
          <div className="bi-grid">
            <AvailablePlot charts={ch} options={[["rack_sales","Rack / aisle revenue","Transactions by rack","sales"],["branch_sales","Sales by location","Recorded business locations","sales"],["product_sales","Sales by product","Recorded product revenue","sales"]]}/>
            <AvailablePlot charts={ch} options={[["shelf_sales","Shelf tier sales","Observed shelf placement","sales"],["category_sales","Category revenue","Recorded category sales","sales"]]}/>
            <AvailablePlot charts={ch} options={[["rack_profit","Gross profit by rack","Requires reliable cost or profit","profit"],["category_profit","Profit by category","Recorded category profit","profit"],["product_sales","Product revenue","Recorded product sales","sales"]]}/>
            <AvailablePlot charts={ch} options={[["branch_sales","Store performance","Historical location sales","sales"],["state_sales","State revenue","Recorded geographic sales","sales"]]}/>
          </div>
          <div className="bi-grid"><TableCard title="Reorder review list" columns={[["sku","SKU"],["location","Location"],["stock","Stock"],["minimum","Min level"],["suggested_minimum_gap","Gap"]]} rows={tb.reorder||[]} empty="No observed stock falls below the recorded minimum, or no minimum level is available."/><TableCard title="Older purchase-date review" columns={[["sku","SKU"],["days_since_purchase","Days since purchase"],["stock","Stock"]]} rows={tb.stock_aging||[]} empty="No older purchase-date records available for review."/></div>
        </> : <>
          <Kpis items={[metric('Recorded sales',k.net_sales),metric('Orders / bills',k.transaction_count),metric('Units sold',k.units_sold),metric('Gross profit',k.gross_profit),metric('Active products',sc.active_skus)]}/>
          <SalesMix charts={ch}/>
          <div className="bi-grid">
            <AvailablePlot charts={ch} options={[["state_sales","State revenue","Regional performance","sales"],["city_sales","City revenue","Location comparison","sales"],["branch_transactions","Bills by region","Unique order count","bills"],["weekday_sales","Revenue by weekday","Recorded demand pattern","sales"]]}/>
            <AvailablePlot charts={ch} options={[["product_profit","Product gross profit","From reported or derived profit","profit"],["category_profit","Category gross profit","Recorded category margins","profit"],["product_units","Product sales volume","Units sold","units"]]}/>
          </div>
        </>}
        <Note title={r.available?.stock ? "What the inventory can—and cannot—tell us" : "Why inventory charts are replaced"}><p>{sc.stock_scope || 'Inventory columns are unavailable. This page uses available recorded sales, product and location information instead.'} The system never invents stock availability, shelf conversion or stockout losses without suitable evidence.</p></Note></>}
      {page===3 && <><SectionHeading n="04" title="Action plan & recommendations" desc="What should the owner review and approve next?"/>
        <Kpis items={[metric('Actions to review',(r.actions||[]).length),metric('Low-stock locations',k.low_stock_skus),metric('Gross profit',k.gross_profit),metric('Recorded units sold',k.units_sold)]}/>
        <div className="bi-action-grid">{(r.actions||[]).map((a,i)=><article className="bi-card bi-action" key={i}><span className="bi-action-priority">{a.priority || 'Review'} · {String(i+1).padStart(2,'0')}</span><h3>{a.action}</h3><p>{a.evidence}</p></article>)}</div>
        <div className="bi-grid"><AvailablePlot charts={ch} options={[["product_sales","Strongest observed products","Sales ranking used for availability checks","sales"],["product_units","Most units sold","Recorded product volumes","units"],["product_records","Product transaction counts","Recorded activity","records"]]}/><AvailablePlot charts={ch} options={[["category_margin","Category profit margins","Margin percentage from recorded profit and revenue","%"],["category_profit","Category gross profit","Measured profit contribution","profit"],["category_sales","Category revenue","Recorded category contribution","sales"],["channel_sales","Sales channel mix","Historical revenue","sales"]]}/></div>
        <Note title="Business decision summary"><p>{r.insights?.slice(0,3).join(' ') || rawDecision.executive_summary || 'Review the available metrics.'}</p><p><strong>Recommended sequence:</strong> verify stock accuracy and supplier lead times; review negative-margin or slow-product groups; test bundles or discounts on a limited sample; measure the change before rolling it out.</p><p><strong>Expected financial impact:</strong> Not calculated. Incremental profit or sales lift requires baselines, inventory costs and evidence from actual interventions.</p></Note>
        <Note title="Four business questions"><div className="bi-questions"><div><strong>What happened?</strong><p>Recorded net sales: {fmt(k.net_sales,2)} across {fmt(k.transaction_count)} identified bills.</p></div><div><strong>Why did it happen?</strong><p>Review category, product, region and discount splits. The source does not prove an underlying cause.</p></div><div><strong>What will happen?</strong><p>Forecasting is reserved for a future validated workflow.</p></div><div><strong>What should we do?</strong><p>{r.actions?.[0]?.action || 'Review source data and business constraints before taking action.'}</p></div></div></Note></>}
      <div className="bi-notes"><AlertTriangle size={14}/><div><strong>Data limitations</strong>{(r.notes||[]).slice(0,4).map((n,i)=><p key={i}>{n}</p>)}</div></div>
    </div>
    <footer className="bi-page-nav"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={14}/> Previous</button><span>{page+1} / 4 · {PAGES[page]}</span><button disabled={page===3} onClick={()=>setPage(p=>Math.min(3,p+1))}>Next <ChevronRight size={14}/></button></footer>
  </section>;
}
