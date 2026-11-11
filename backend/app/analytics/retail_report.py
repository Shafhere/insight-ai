"""Dataset-grounded retail report. Missing business fields stay unavailable.

A transaction file is NOT a stock ledger: inventory metrics describe the latest
SKU/store snapshot only, and missing stock history is never manufactured.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from itertools import combinations
import math
import re
import pandas as pd


def _find(df, *aliases):
    names = {re.sub(r'[^a-z0-9]', '', str(c).lower()): c for c in df.columns}
    for alias in aliases:
        key = re.sub(r'[^a-z0-9]', '', alias.lower())
        if key in names:
            return names[key]
    return None


def _number(s):
    if pd.api.types.is_numeric_dtype(s):
        return pd.to_numeric(s, errors='coerce')
    st = s.astype('string').str.strip().str.replace(r'[₹$€£,\s]', '', regex=True)
    st = st.str.replace(r'^\((.*)\)$', r'-\1', regex=True)
    return pd.to_numeric(st, errors='coerce')


def _flt(value):
    try:
        v = float(value)
        return round(v, 2) if math.isfinite(v) else None
    except (ValueError, TypeError, OverflowError):
        return None


def _chart(series, limit=9, ascending=False):
    if series is None or series.empty:
        return []
    ranked = series.sort_values(ascending=ascending).head(limit)
    return [{'name': str(k), 'value': _flt(v)} for k, v in ranked.items() if _flt(v) is not None]


def build_retail_report(df: pd.DataFrame, quality: dict | None = None) -> dict:
    """Return compact, JSON-safe observed results for four report pages."""
    quality = quality or {}
    result = {'available': {}, 'kpis': {}, 'scope': {}, 'charts': {}, 'tables': {}, 'insights': [], 'actions': [], 'notes': []}
    if df.empty:
        result['notes'].append('Dataset contains no rows.')
        return result
    x = df.copy()
    c = {
        'bill': _find(x, 'bill_number','transaction_id','order_id','invoice_id','invoice','bill_no'),
        'date': _find(x, 'bill_date','transaction_date','order_date','date','timestamp','sale_date'),
        'time': _find(x, 'bill_time','transaction_time','order_time','time','hour'),
        'branch': _find(x, 'branch_name','store_id','store_name','store','region','location','state','city'),
        'state': _find(x, 'state','province'),
        'city': _find(x, 'city','town'),
        'customer': _find(x, 'customer_id','customer_phone','customer_number'),
        'product': _find(x, 'item_name','product_name','product','item','sku','item_code','product_id'),
        'sku': _find(x, 'item_code','sku','product_id','product_code','item_name','product_name','product'),
        'category': _find(x, 'department','category','product_category','product_type'),
        'subcategory': _find(x, 'subcategory','sub_category','brand'),
        'brand': _find(x, 'brand'),
        'quantity': _find(x, 'quantity_sold','quantity','qty','units_sold','units','quantity_ordered','units_ordered'),
        'unit_price': _find(x, 'selling_price','unit_price','sale_price','price_per_unit'),
        'gross': _find(x, 'gross_sales','gross_revenue','gross_amount'),
        'net': _find(x, 'net_sales','net_revenue','total_amount','total_revenue','revenue','sales_amount','sales_value','total_sales','sales'),
        'cost': _find(x, 'purchase_cost','unit_cost','cost_price','cost_per_unit'),
        'total_cost': _find(x, 'cost_amount','total_cost','cost_of_goods_sold','cogs','purchase_amount'),
        'profit': _find(x, 'profit','gross_profit','profit_amount'),
        'discount': _find(x, 'discount_amount','discount','discount_value'),
        'payment': _find(x, 'payment_mode','payment_method','payment_type'),
        'stock': _find(x, 'closing_stock','current_stock_on_hand','current_stock','stock_on_hand','inventory_level'),
        'minimum': _find(x, 'minimum_stock_level','reorder_level','minimum_stock','reorder_point'),
        'opening': _find(x, 'opening_stock'),
        'last_purchase': _find(x, 'last_purchase_date','last_restock_date'),
        'lead': _find(x, 'supplier_lead_time_days','lead_time_days'),
        'rack': _find(x, 'rack_number','rack_id','aisle_zone','aisle'),
        'shelf': _find(x, 'shelf_position','shelf_tier','shelf_level'),
        'floor': _find(x, 'floor_section','warehouse','warehouse_zone'),
        'capacity': _find(x, 'maximum_shelf_capacity','rack_capacity','shelf_capacity'),
        'returned': _find(x, 'return_status','order_status','is_returned','returned'),
        'target': _find(x, 'sales_target','revenue_target'),
        'channel': _find(x, 'sales_channel','channel','platform','order_channel'),
    }
    result['available'] = {name: col is not None for name,col in c.items()}
    # Expose only the matched COLUMN NAMES, never customer values or raw rows.
    result['detected_columns'] = {name: str(col) if col is not None else None for name, col in c.items()}
    qty = _number(x[c['quantity']]) if c['quantity'] else None
    unit = _number(x[c['unit_price']]) if c['unit_price'] else None
    discount = _number(x[c['discount']]) if c['discount'] else None
    revenue = _number(x[c['net']]) if c['net'] else None
    gross = _number(x[c['gross']]) if c['gross'] else None
    # Derive revenue only from an identified selling price and sold quantity.
    if revenue is None and qty is not None and unit is not None:
        revenue = qty * unit - (discount.fillna(0) if discount is not None else 0)
        result['notes'].append('Net sales derived from quantity × selling price minus recorded discount.')
    if gross is None and qty is not None and unit is not None:
        gross = qty * unit
    if 'discountprice' in {re.sub(r'[^a-z0-9]', '', str(col).lower()) for col in x.columns} and c['discount'] is None:
        result['notes'].append('Discount Price is ambiguous (discounted unit price or discount value); it was not subtracted or treated as discount amount.')
    if discount is not None and c['discount'] and 'percent' in c['discount'].lower():
        result['notes'].append('Discount percentages were not treated as monetary amounts.')
        if c['net'] is None and gross is not None:
            revenue = None  # never subtract a percentage as currency
    costs = _number(x[c['cost']]) if c['cost'] else None
    # Prefer recorded profit; total cost is per line, while unit cost is per unit.
    # Never multiply cost_amount by quantity (that would double-count costs).
    direct_profit = _number(x[c['profit']]) if c['profit'] else None
    total_cost = _number(x[c['total_cost']]) if c['total_cost'] else None
    profit = direct_profit if direct_profit is not None else (revenue - total_cost if revenue is not None and total_cost is not None else (revenue - costs * qty if revenue is not None and costs is not None and qty is not None else None))
    if direct_profit is not None:
        result['notes'].append('Gross profit uses the provided profit column; verify whether it includes taxes, fees or returns.')
    elif total_cost is not None:
        result['notes'].append('Gross profit is recorded sales minus line-level total cost; no extra quantity multiplication.')
    dates = pd.to_datetime(x[c['date']], errors='coerce') if c['date'] else None
    valid_dates = dates.dropna() if dates is not None else pd.Series(dtype='datetime64[ns]')
    bill = x[c['bill']].astype('string') if c['bill'] else None
    orders = int(bill.nunique(dropna=True)) if bill is not None else None
    total_rev = _flt(revenue.sum()) if revenue is not None and revenue.notna().any() else None
    total_profit = _flt(profit.sum()) if profit is not None and profit.notna().any() else None
    total_units = _flt(qty.sum()) if qty is not None and qty.notna().any() else None
    margin = _flt(total_profit / total_rev * 100) if total_profit is not None and total_rev not in (None,0) else None
    mean_order = _flt(total_rev/orders) if orders and total_rev is not None else None
    result['kpis'] = {'net_sales': total_rev, 'gross_sales': _flt(gross.sum()) if gross is not None else None,
        'gross_profit': total_profit, 'gross_margin_pct': margin, 'transaction_count': orders,
        'average_transaction_value': mean_order, 'units_sold': total_units,
        'units_per_transaction': _flt(total_units/orders) if orders and total_units is not None else None,
        'unique_customers': int(x[c['customer']].nunique(dropna=True)) if c['customer'] else None,
        'discount_total': _flt(discount.sum()) if discount is not None else None}
    result['scope'] = {'records': len(x), 'first_date': str(valid_dates.min().date()) if len(valid_dates) else None,
        'last_date': str(valid_dates.max().date()) if len(valid_dates) else None,
        'active_skus': int(x[c['sku']].nunique(dropna=True)) if c['sku'] else None,
        'locations': int(x[c['branch']].nunique(dropna=True)) if c['branch'] else None,
        'missing_cells': int(x.isna().sum().sum()), 'duplicate_rows': int(x.duplicated().sum()),
        'quality_score': quality.get('quality_score'),
        'data_note': 'Quality checks are indicators, not proof of perfect data.'}
    if not c['stock']:
        result['scope']['stock_scope'] = 'No stock/inventory snapshot in this file. Inventory analysis is replaced by available sales and customer evidence.'
    result['notes'].append('Financial measures use recorded sales and profit when available; otherwise profit uses supported costs. Expenses and taxes may be excluded. No unsupported financial figures are inferred.')
    group = lambda col, values: values.groupby(x[col].fillna('Unknown')).sum() if col and values is not None else None
    if revenue is not None:
        for key in ('branch','state','city','product','category','subcategory','brand','payment','channel','rack','shelf'):
            if c[key]: result['charts'][f'{key}_sales'] = _chart(group(c[key],revenue), 10)
    if profit is not None:
        for key in ('category','branch','product','rack','shelf'):
            if c[key]: result['charts'][f'{key}_profit'] = _chart(group(c[key],profit), 10)
    if qty is not None:
        for key in ('product','category','branch'):
            if c[key]: result['charts'][f'{key}_units'] = _chart(group(c[key],qty), 10)
    if dates is not None and revenue is not None:
        periods = pd.DataFrame({'when': dates, 'revenue': revenue, 'profit': profit if profit is not None else float('nan')}).dropna(subset=['when'])
        if len(periods):
            period_sales = periods.groupby(periods['when'].dt.to_period('M'))[['revenue','profit']].sum()
            result['charts']['monthly_revenue'] = [{'period':str(p), 'value':_flt(row.revenue), 'profit':_flt(row.profit) if profit is not None else None} for p,row in period_sales.tail(24).iterrows()]
            monthly = period_sales.revenue
            if len(monthly)>1:
                prior, current = float(monthly.iloc[-2]), float(monthly.iloc[-1])
                result['kpis']['sales_growth_pct'] = _flt((current-prior)/abs(prior)*100) if prior else None
                result['notes'].append('Month-over-month growth compares the two latest recorded calendar months; incomplete months may distort comparisons.')
            period_hours = dates.dt.hour
            if c['time']:
                times = pd.to_datetime(x[c['time']].astype(str), format='%H:%M:%S', errors='coerce')
                period_hours = period_hours.where(period_hours.notna(), times.dt.hour)
            else:
                result['notes'].append('Hourly heatmap is unavailable unless timestamps or bill times are supplied.')
            when = pd.DataFrame({'weekday':dates.dt.day_name(),'hour':period_hours}).dropna()
            if not when.empty:
                counts = when.groupby(['weekday','hour']).size()
                result['charts']['hour_heatmap'] = [{'day':str(day),'hour':int(hr),'value':int(v)} for (day,hr),v in counts.items()]
    if dates is not None and revenue is not None and len(valid_dates):
        weekday_sales = pd.DataFrame({'day': dates.dt.day_name(), 'sales': revenue}).dropna().groupby('day')['sales'].sum()
        order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
        result['charts']['weekday_sales'] = [{'name': day, 'value': _flt(weekday_sales[day])} for day in order if day in weekday_sales]
    if c['bill'] and c['branch']:
        result['charts']['branch_transactions'] = _chart(x.groupby(c['branch'])[c['bill']].nunique(), 10)
    if c['category'] and qty is not None:
        result['charts']['category_units'] = _chart(group(c['category'], qty), 10)
    # When product/category data exists without valid sales values, record-count
    # charts still describe the uploaded file; they must NOT be labelled revenue.
    for key in ('category','product','branch','payment','channel'):
        if c[key]:
            result['charts'][f'{key}_records'] = _chart(x[c[key]].fillna('Unknown').astype(str).value_counts(), 10)
    if revenue is None:
        result['notes'].append('No reliable monetary sales measure found. Showing counts and quantities instead; revenue/profit are not estimated.')
    if c['category'] and revenue is not None and profit is not None:
        groups = x[c['category']].fillna('Unknown')
        temp = pd.DataFrame({'sales':revenue, 'profit':profit,'category':groups}).groupby('category')[['sales','profit']].sum()
        result['charts']['category_margin'] = [{'name':str(k),'value':_flt(row.profit / row.sales * 100) if row.sales else None,'sales':_flt(row.sales)} for k,row in temp.iterrows() if row.sales]
    if bill is not None and c['product']:
        # Every unique product in an actual bill counts only once per basket.
        baskets = pd.DataFrame({'bill':bill,'item':x[c['product']].astype(str)}).dropna().drop_duplicates()
        basket_sizes = baskets.groupby('bill').size()
        small = basket_sizes[basket_sizes.between(2,15)].index
        pairs = Counter()
        for _,g in baskets[baskets.bill.isin(small)].groupby('bill'):
            pairs.update(combinations(sorted(set(g.item.tolist())),2))
        result['tables']['basket_pairs'] = [{'items':f'{a} + {b}','orders_together':n} for (a,b),n in pairs.most_common(7)]
    if discount is not None and revenue is not None:
        discounted = discount.fillna(0)>0
        result['charts']['promotion_sales'] = [{'name':'Discounted transactions','value':_flt(revenue[discounted].sum())}, {'name':'Full-price transactions','value':_flt(revenue[~discounted].sum())}]
        result['notes'].append('Discounted vs full-price sales is an observed comparison, not proof that promotions caused higher sales.')
    if c['returned']:
        counts = x[c['returned']].fillna('Unknown').astype(str).value_counts().head(8)
        result['charts']['return_status'] = _chart(counts)
    # An uploaded transaction table often repeats the same SKU stock value across rows.
    # Keep only the last observation for each SKU per location, never SUM stock per sale.
    if c['stock'] and c['sku']:
        stock_cols = [c['sku']] + ([c['branch']] if c['branch'] else [])
        snapshot = x.copy()
        if dates is not None: snapshot['_sort_date'] = dates
        snapshot = snapshot.sort_values('_sort_date',kind='stable') if '_sort_date' in snapshot else snapshot
        snapshot = snapshot.drop_duplicates(subset=stock_cols,keep='last')
        stock = _number(snapshot[c['stock']]); minimum = _number(snapshot[c['minimum']]) if c['minimum'] else None
        snapshot['_stock'] = stock
        if minimum is not None: snapshot['_minimum'] = minimum
        valid_stock = stock.dropna()
        result['kpis']['current_stock_units'] = _flt(valid_stock.sum()) if len(valid_stock) else None
        result['scope']['stock_scope'] = 'Latest observed stock per SKU/location; values may be stale.'
        if minimum is not None:
            lows = snapshot[snapshot['_stock'].notna() & snapshot['_minimum'].notna() & (snapshot['_stock']<=snapshot['_minimum'])]
            result['kpis']['low_stock_skus'] = len(lows)
            result['tables']['reorder'] = [{'sku':str(row[c['sku']]), 'location':str(row[c['branch']]) if c['branch'] else None,
                'stock':_flt(row['_stock']), 'minimum':_flt(row['_minimum']),
                'suggested_minimum_gap':_flt(max(0,row['_minimum']-row['_stock']))} for _,row in lows.head(12).iterrows()]
        else:
            result['notes'].append('Reorder recommendations unavailable without minimum stock levels.')
        if c['last_purchase']:
            last = pd.to_datetime(snapshot[c['last_purchase']],errors='coerce')
            ref = valid_dates.max() if len(valid_dates) else pd.Timestamp.today().normalize()
            age = (ref-last).dt.days
            snapshot['_age'] = age
            aged = snapshot[(snapshot['_age']>90) & (snapshot['_stock']>0)]
            result['tables']['stock_aging'] = [{'sku':str(row[c['sku']]),'days_since_purchase':int(row['_age']),'stock':_flt(row['_stock'])} for _,row in aged.head(12).iterrows()]
            result['notes'].append('Days since last purchase is not the same as verified stock age. Review recent sales before classifying dead stock.')
        result['notes'].append('Stockout losses and shelf-level conversion cannot be estimated reliably from sales and current stock snapshots alone; stockout event history and traffic/visit observations are needed.')
    else:
        result['notes'].append('Inventory and stockout metrics unavailable: upload a SKU/location stock snapshot to enable them.')
    if c['shelf'] and revenue is not None:
        result['notes'].append('Shelf performance is observed revenue by placement; improvement from moving products cannot be attributed without controlled comparisons.')
    if c['target']:
        target = _number(x[c['target']]); result['kpis']['target_attainment_pct'] = _flt(total_rev/target.sum()*100) if total_rev is not None and target.sum()>0 else None
    # Concise findings are generated from measurements; missing findings are not invented.
    for key, label in [('branch_sales','location'),('product_sales','product'),('category_sales','category')]:
        rows = result['charts'].get(key,[])
        if rows:
            top=rows[0]; result['insights'].append(f"Highest recorded {label} sales: {top['name']} ({top['value']:,.2f}).")
            if len(rows)>1: result['insights'].append(f"Lowest in displayed top {len(rows)} {label} ranking: {rows[-1]['name']} ({rows[-1]['value']:,.2f}); this is not necessarily the lowest across all groups.")
    if result['tables'].get('reorder'):
        top = result['tables']['reorder'][0]
        result['actions'].append({'priority':'High','action':f"Review reorder for SKU {top['sku']} at {top['location'] or 'the store'}", 'evidence':f"Stock {top['stock']} vs minimum {top['minimum']}; check supplier lead time and available orders before purchasing."})
    if result['tables'].get('basket_pairs'):
        item=result['tables']['basket_pairs'][0]
        result['actions'].append({'priority':'Medium','action':f"Consider testing a bundle for {item['items']}", 'evidence':f"Bought together in {item['orders_together']} recorded bills; incremental profit has not been validated."})
    if result['charts'].get('product_sales'):
        top=result['charts']['product_sales'][0]
        result['actions'].append({'priority':'Medium','action':f"Protect availability of {top['name']}", 'evidence':f"Recorded sales {top['value']:,.2f}; verify stock, margin and demand before ordering."})
    if result['charts'].get('category_margin'):
        low=min(result['charts']['category_margin'],key=lambda z:z['value'] if z['value'] is not None else 1e99)
        result['actions'].append({'priority':'Review','action':f"Investigate margin in {low['name']}", 'evidence':f"Recorded category margin {low['value']}%; investigate discount mix and costs, not assumed causes."})
    if not result['actions']:
        result['actions'].append({'priority':'Review','action':'Confirm missing profit, stock and transaction fields before operational decisions','evidence':'The available dataset does not support specific inventory or financial-impact estimates.'})
    result['notes'].append('No causal uplift, lost sales, footfall, stock turnover or forecast is claimed without the necessary evidence.')
    return result
