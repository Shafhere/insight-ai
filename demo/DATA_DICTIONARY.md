# Data Dictionary — INSIGHT AI Fashion Retail

This pack uses clear column names and an explicit **row grain** to make relationships unambiguous.

## 1. `FASHION_SALES_15000.csv` (15,000 order lines)

| Column(s) | Meaning | Usage |
|---|---|---|
| `order_line_id` | Unique ID for every sale line | Primary key in Sales |
| `order_id` | Same ID repeated across the lines of one customer order | Orders and order-level aggregation; **not unique in Sales** |
| `order_date` | ISO calendar date of purchase | Weekly/monthly trend and forecasting |
| `customer_id` | Stable ID when the customer was identified; blank for some walk-ins | Customer repeat-purchase analysis |
| `store_id`, `store_name`, `store_city` | Retail branch | Compare branches; store ID is stable |
| `sku` | Stable unique product code referring to Products | Join key to Products |
| `product_name`, `category`, `subcategory`, `size`, `color` | Sale-time product description | Product/category analytics; some fields intentionally repeat for single-file use |
| `quantity` | Original units purchased before returns | Gross volume |
| `returned_quantity` | Units returned/refunded on that sale line | Return rate |
| `units_sold` | `quantity - returned_quantity` | **Net units sold**: recommend for demand/revenue forecasting |
| `unit_list_price_inr` | Unit catalog price, exclusive of GST | Pricing analysis |
| `discount_pct` | Discount percent at transaction time | Discount analysis |
| `gross_sales_inr` | `quantity × unit_list_price_inr` | Sales before discounts and refunds |
| `discount_amount_inr` | `gross_sales_inr × discount_pct / 100` | Discounts given on original purchase |
| `net_unit_price_inr` | Unit price after discount | Net price after discount, before tax |
| `net_sales_inr` | `units_sold × net_unit_price_inr` | **Net sales revenue** after returns and discounts; select this for revenue forecasting |
| `unit_purchase_cost_inr` | Illustrative item acquisition cost | Gross margin calculation |
| `cost_of_goods_sold_inr` | `units_sold × unit_purchase_cost_inr` | Net merchandise cost of sold units |
| `gross_margin_inr` | `net_sales_inr - cost_of_goods_sold_inr` | **Gross margin**, not net company profit |
| `payment_method`, `sales_channel` | Transaction purchase channel | Performance breakdowns |
| `promotion`, `shopping_occasion` | Transaction context, not the customer's religion or identity | Seasonal descriptive analysis |
| `return_reason` | Short return explanation when returned units exist | Returns analysis |
| `sales_staff_id` | Pseudonymous sales-associate code | Team-level operations, not employee evaluation |

### Aggregation rules

- Revenue: `sum(net_sales_inr)`.
- Gross merchandise margin: `sum(gross_margin_inr)`.
- Orders: **distinct count** of `order_id` (not count of sale lines).
- Customers: **distinct count** of nonblank `customer_id`.
- Units: `sum(units_sold)` for net physical sales.
- For customer RFM: first aggregate sale lines to an order-level table keyed by (`customer_id`, `order_id`), then compute customer recency, frequency and monetary value.
- For demand forecasting: carefully distinguish net sales, units sold and returns. Stockouts, holidays and promotional effects may bias demand predictions.
- GST, operating expenses, delivery cost, payroll, real cash flows and net profit are **not provided**.

## 2. `FASHION_CUSTOMERS_2600.csv` (2,600 customer accounts)

| Column | Meaning |
|---|---|
| `customer_id` | **Primary key**, stable pseudonymous account ID |
| `customer_name` | Fictional, obvious demo display name |
| `masked_phone` | Non-dialable synthetic placeholder; never use for outreach |
| `signup_date` | Account registration date |
| `home_city` | Fictional local city field |
| `preferred_store_id` | Customer-entered or demo-assigned preferred store ID |
| `membership_tier` | Existing demo membership tier; do not use as a churn ground truth |
| `signup_channel` | How the account was registered |
| `preferred_language` | Fictional communication preference field, not inferred from transactions |
| `marketing_contact_permission`, `contact_channel` | Explicitly mark this data as **not valid permission** to contact customers |

A customer in this file may have zero recorded purchases. Some sale lines have no customer ID and must not be attributed to an arbitrary individual.

## 3. `FASHION_PRODUCTS_165.csv` (165 unique SKUs)

| Column | Meaning |
|---|---|
| `sku` | **Primary key**, joins to Sales |
| `product_name`, `category`, `subcategory`, `brand`, `primary_color`, `size_range` | Master product attributes |
| `unit_list_price_inr`, `unit_purchase_cost_inr` | Current reference prices/costs; **transaction-time values in Sales** should be used for historical profit analysis |
| `supplier_region`, `supplier_lead_time_days` | Illustrative supplier metadata |
| `current_company_stock_units`, `stock_snapshot_date` | Company-level stock snapshot at 2026-10-31, **not branch-level stock** |
| `product_active` | Current catalog availability marker |

No real stock-order recommendations should be made without checking current on-hand inventory, stock already ordered, lead times and forecast uncertainty.

## 4. `FASHION_FEEDBACK_750.csv` (750 order-level replies)

| Column | Meaning |
|---|---|
| `feedback_id` | **Primary key**, one unique survey response |
| `order_id` | **Unique within Feedback**; relates to an order, not a sale line |
| `customer_id` | Identified customer who submitted the feedback |
| `feedback_date` | Date feedback was submitted |
| `rating_1_to_5` | Direct self-reported satisfaction signal on a 1–5 scale |
| `feedback_topic`, `feedback_comment` | Topic and text of the fictional feedback |
| `feedback_channel` | In-store, QR or email survey |
| `follow_up_requested` | Whether the respondent requested follow-up (demo field only) |
| `resolution_status` | Fictional issue resolution state |

Feedback comes from a subset of known customers. It does not represent all customers; survey response bias and low sample sizes should be acknowledged.

## Minimum columns for features on an arbitrary imported retail dataset

| Feature | Minimum practical columns |
|---|---|
| Ordinary analytics | Date (for trends), numeric measures, categories |
| Revenue forecasting | Transaction date + net sales or another valid numeric target, enough historical periods |
| Customer RFM | Stable customer ID + transaction/order ID + purchase date + amount |
| Repeat-purchase monitoring | Same as customer RFM, with enough time between purchases |
| Customer-product preference | Customer ID + SKU/category + purchase quantity/amount |
| Customer feedback analytics | Customer ID + rating/feedback + date; may use order ID |
| Data modeling | Unique primary key in master files, compatible foreign-key columns, accepted join strategy |
| Branch stock planning | Branch-level current inventory + dated sales + SKU, beyond this pack's company-wide stock snapshot |

A name or phone number is not sufficient by itself for reliable customer matching if names are repeated, numbers change, or records are entered inconsistently. Prefer a stable customer ID; normalize/hash phone numbers only with appropriate permission and data governance.
