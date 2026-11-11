"""Defensive checks for observed retail metrics, no invented business evidence."""
import pandas as pd
from app.analytics.retail_report import build_retail_report


def test_retail_calculations_and_stock_deduplication():
    frame = pd.DataFrame({
        'bill_number':['B1','B1','B2','B3'],
        'bill_date':['2026-09-01','2026-09-01','2026-10-01','2026-10-02'],
        'item_code':['A','B','A','A'],
        'item_name':['Shirt','Shoes','Shirt','Shirt'],
        'department':['Fashion','Footwear','Fashion','Fashion'],
        'quantity':[2,1,1,1],
        'selling_price':[100,200,100,100],
        'total_amount':[190,200,100,100],
        'purchase_cost':[40,110,40,40],
        'discount':[10,0,0,0],
        'branch_name':['North']*4,
        'closing_stock':[9,8,6,5],
        'minimum_stock_level':[6,2,6,6],
    })
    report=build_retail_report(frame)
    k=report['kpis']
    assert k['net_sales']==590
    assert k['transaction_count']==3  # B1 has two lines, not two bills
    assert k['gross_profit']==320
    assert k['gross_margin_pct']==54.24
    assert k['current_stock_units']==13  # latest A=5, B=8, not 28
    assert k['low_stock_skus']==1
    assert report['tables']['reorder'][0]['sku']=='A'
    assert report['tables']['basket_pairs'][0]['orders_together']==1


def test_missing_evidence_is_not_fabricated():
    report=build_retail_report(pd.DataFrame({'product_name':['Shirt','Coat'],'region':['West','East']}))
    assert report['kpis']['net_sales'] is None
    assert report['kpis']['gross_profit'] is None
    assert report['kpis']['current_stock_units'] if 'current_stock_units' in report['kpis'] else None is None
    assert not report['tables'].get('reorder')
    assert not report['charts'].get('monthly_revenue')
    assert 'forecast' not in report


def test_currency_strings_and_discounts():
    report=build_retail_report(pd.DataFrame({
        'bill_number':['1','2'], 'item_name':['Pen','Pad'],
        'quantity':[2,1], 'selling_price':['₹100.00','$250.00'],
        'discount':['₹10','₹0'], 'purchase_cost':['40','120'],
    }))
    assert report['kpis']['net_sales']==440
    assert report['kpis']['gross_profit']==240
