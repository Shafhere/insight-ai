"""A small ordinary sales export must produce an honest and useful report."""
import pandas as pd
from app.analytics.retail_report import build_retail_report


def small_sales_export(n=250):
    records=[]
    for i in range(n):
        qty=(i%4)+1
        sale=float((i%6+1)*80)
        cost=round(sale*.65,2)
        records.append({
            'Order ID':f'O-{i//2:04}', 'Order Date':f'2026-{(i%6)+1:02d}-{(i%25)+1:02d}',
            'Customer ID':f'C-{i%48}', 'Customer Name':f'Customer {i%48}',
            'Region':['North','South','East'][i%3], 'State':['Kerala','Tamil Nadu'][i%2],
            'City':['Kochi','Chennai','Calicut'][i%3],
            'Category':['Clothing','Electronics','Home'][i%3],
            'Subcategory':['Shirts','Audio','Furniture'][i%3],
            'Product':['Shirt','Headphones','Chair'][i%3],
            'Sales Person':f'Employee {i%5}', 'Quantity':qty,
            'Unit Price':sale/qty, 'Discount Price':10,
            'Sales':sale, 'Cost Amount':cost, 'Profit':round(sale-cost,2),
            'Payment Method':['Card','Cash'][i%2], 'Channel':['Online','In Store'][i%2]
        })
    return pd.DataFrame(records)


def test_generic_small_report_uses_sales_profit_and_business_breakdowns():
    df=small_sales_export()
    r=build_retail_report(df)
    assert r['scope']['records']==250
    assert r['detected_columns']['net']=='Sales'
    assert r['detected_columns']['profit']=='Profit'
    assert r['detected_columns']['total_cost']=='Cost Amount'
    assert abs(r['kpis']['net_sales']-df.Sales.sum())<.01
    assert abs(r['kpis']['gross_profit']-df.Profit.sum())<.01
    assert r['kpis']['transaction_count']==125
    for key in ['monthly_revenue','branch_sales','state_sales','city_sales','product_sales','category_sales','category_margin','product_units','payment_sales','channel_sales','weekday_sales']:
        assert r['charts'][key],key
    assert r['available']['stock'] is False
    assert r['kpis'].get('current_stock_units') is None
    assert r['actions']


def test_total_cost_is_not_multiplied_by_quantity():
    df=small_sales_export().drop(columns=['Profit'])
    r=build_retail_report(df)
    assert abs(r['kpis']['gross_profit']-(df.Sales-df['Cost Amount']).sum())<.01


def test_when_cost_and_stock_missing_no_financial_or_stock_claims():
    df=small_sales_export().drop(columns=['Profit','Cost Amount','Discount Price'])
    r=build_retail_report(df)
    assert r['kpis']['net_sales'] is not None
    assert r['kpis']['gross_profit'] is None
    assert r['kpis'].get('current_stock_units') is None
    assert r['charts']['product_sales']
    assert r['charts']['category_sales']
    assert r['actions']


def test_existing_rich_retail_columns_still_supported():
    df=pd.DataFrame({'bill_number':['b1','b2'],'bill_date':['2026-01-01','2026-01-02'],
                     'branch_name':['Store A','Store B'],'item_name':['Mug','Cup'],
                     'department':['Home','Home'],'quantity':[2,3],
                     'total_amount':[200,450],'purchase_cost':[60,90],
                     'closing_stock':[4,0],'minimum_stock_level':[5,2]})
    r=build_retail_report(df)
    assert r['kpis']['net_sales']==650
    assert r['kpis']['gross_profit']==260
    assert r['kpis']['low_stock_skus']==2
    assert r['tables']['reorder']


def test_full_admin_report_preview_for_small_sales_export(tmp_path, monkeypatch):
    """The entire report endpoint must accept an ordinary 250-row sales export."""
    import uuid
    from app.api import portal
    from app.config import settings
    from app.data.dataset_service import analyse_saved_dataset

    monkeypatch.setattr(settings, 'storage_dir', tmp_path)
    dataset_id = str(uuid.uuid4())
    folder = tmp_path / dataset_id
    folder.mkdir()
    file = folder / 'original.csv'
    small_sales_export().to_csv(file, index=False)
    analyse_saved_dataset(file, dataset_id, 'normal_shop.csv')
    from types import SimpleNamespace
    monkeypatch.setattr(portal, 'authenticate_request', lambda request, roles: {'role': 'admin'})
    payload = portal.preview_report(dataset_id, SimpleNamespace(), 'auto')
    assert payload['retail']['scope']['records'] == 250
    assert payload['retail']['charts']['product_sales']
    assert payload['retail']['charts']['category_sales']
    assert payload['retail']['kpis']['gross_profit'] is not None
    assert payload['retail_filters']['category']
    import json
    json.dumps(payload, allow_nan=False)
