"""Avoid wrong forecasts/cleaning caused by a name-only semantic collision."""
import pandas as pd
from app.data.schema_detection import infer_semantic_type


def test_sales_channel_not_revenue():
    assert infer_semantic_type('sales_channel', pd.Series(['Store', 'Online'])) == 'categorical'


def test_inventory_is_not_units_sold():
    assert infer_semantic_type('inventory_level', pd.Series([45, 60])) == 'inventory'


def test_sales_region_is_location():
    assert infer_semantic_type('sales_region', pd.Series(['North', 'South'])) == 'location'


def test_real_revenue_quantity_still_work():
    assert infer_semantic_type('total_sales', pd.Series([100, 200])) == 'revenue'
    assert infer_semantic_type('quantity', pd.Series([3, 5])) == 'quantity'
