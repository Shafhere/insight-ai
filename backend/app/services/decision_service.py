
from app.modules.decision.engine import generate_findings
from app.schemas.decision import DecisionReport
from app.services.analytics_service import (
    get_semantic_columns,
    load_analytics_dataset,
)
from app.services.llm_service import generate_response
from app.services.business_intelligence_service import build_business_context


def _parse_report_sections(response: str) -> dict[str, str]:
    """Extract the three expected sections from the LLM response."""
    section_names = (
        "EXECUTIVE SUMMARY:",
        "RECOMMENDATIONS:",
        "RISKS:",
    )

    sections = {name: [] for name in section_names}
    current_section = None

    for line in response.splitlines():
        stripped = line.strip()
        upper = stripped.upper()

        matched = next(
            (
                name
                for name in section_names
                if upper.startswith(name)
            ),
            None,
        )

        if matched:
            current_section = matched
            remainder = stripped[len(matched):].strip()

            if remainder:
                sections[current_section].append(remainder)

        elif current_section and stripped:
            sections[current_section].append(stripped)

    return {
        name: "\n".join(lines).strip()
        for name, lines in sections.items()
    }


def _clean_bullet_items(section: str) -> list[str]:
    """Convert a multiline recommendation or risk section into items."""
    items = []

    for line in section.splitlines():
        cleaned = line.strip()

        if not cleaned:
            continue

        cleaned = cleaned.lstrip("-•* ").strip()

        if cleaned:
            items.append(cleaned)

    return items



def _money(value):
    if value is None:
        return "not available"
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value)


def _build_business_narrative(context: dict) -> dict[str, str]:
    """Create evidence-led report paragraphs from deterministic dataset metrics."""
    paragraphs = {}
    rows = context.get("rows", 0)
    date_range = context.get("date_range") or {}
    period = (f"from {date_range['start']} to {date_range['end']}"
              if date_range.get("start") and date_range.get("end") else "the available reporting period")
    parts = [f"The analysis covers {rows:,} transaction or observation records across {context.get('columns', 0)} columns, covering {period}."]
    if context.get("total_revenue") is not None:
        parts.append(f"Recorded or derived revenue totals {_money(context['total_revenue'])}.")
    if context.get("total_quantity") is not None:
        parts.append(f"The dataset contains {_money(context['total_quantity'])} units in the selected quantity field.")
    comparison = context.get("latest_month_comparison")
    if comparison:
        change = comparison.get("change_percent")
        if change is not None:
            direction = "increased" if change > 0 else "decreased" if change < 0 else "remained unchanged"
            parts.append(f"Revenue {direction} by {abs(change):.2f}% from {comparison['previous_month']} ({_money(comparison['previous_revenue'])}) to {comparison['latest_month']} ({_money(comparison['latest_revenue'])}).")
        else:
            parts.append(f"Revenue was {_money(comparison['latest_revenue'])} in {comparison['latest_month']} versus {_money(comparison['previous_revenue'])} in {comparison['previous_month']}; a percentage change cannot be calculated because the earlier period is zero or unavailable.")
    else:
        parts.append("A month-over-month revenue comparison could not be produced from the available date and revenue fields.")
    paragraphs["overall_performance"] = " ".join(parts)

    category = context.get("category_revenue", [])
    category_qty = {x['category']: x.get('quantity') for x in context.get('category_quantity', [])}
    if category:
        top = category[0]
        bottom = min(category, key=lambda x: x.get('revenue') if x.get('revenue') is not None else float('inf'))
        text = f"The highest-revenue category is {top['category']} with {_money(top.get('revenue'))}. The lowest-revenue category in the supplied ranking is {bottom['category']} with {_money(bottom.get('revenue'))}."
        if top['category'] in category_qty:
            text += f" The leading category recorded {_money(category_qty[top['category']])} units."
        text += " These are historical comparisons; they identify where performance is concentrated but do not establish the reasons behind the difference."
        paragraphs["category_performance"] = text
    else:
        paragraphs["category_performance"] = "Category-level performance could not be calculated because a usable category field or revenue metric was not available."

    products = context.get("product_revenue", [])
    low_products = context.get("lowest_product_revenue", [])
    if products:
        top = products[0]
        text = f"The highest-revenue product in the available ranking is {top['product']} ({_money(top.get('revenue'))})."
        if low_products:
            low = low_products[0]
            text += f" The lowest-revenue product in the displayed low-performing group is {low['product']} ({_money(low.get('revenue'))})."
        text += " Low historical revenue is a signal to investigate availability, pricing, promotion, customer demand and lifecycle; it is not, by itself, a reason to discontinue an item."
        paragraphs["product_performance"] = text
    else:
        paragraphs["product_performance"] = "Product-level rankings are unavailable because no product or SKU field was identified. The report therefore avoids making product-specific claims."

    locations = context.get("location_revenue", [])
    if locations:
        high, low = locations[0], min(locations, key=lambda x: x.get('revenue') if x.get('revenue') is not None else float('inf'))
        paragraphs["regional_performance"] = f"{high['location']} has the highest recorded revenue in the displayed location comparison ({_money(high.get('revenue'))}), while {low['location']} has the lowest ({_money(low.get('revenue'))}). Management can review local demand, product mix, operating hours, availability and marketing coverage before deciding where to focus. Revenue differences alone do not prove the cause of regional performance."
    else:
        paragraphs["regional_performance"] = "Location-level comparisons are unavailable because the dataset does not contain a usable region, branch, city or location field alongside a business metric."

    qty_comp = context.get("latest_month_quantity_comparison")
    if qty_comp:
        prev, latest = qty_comp.get("previous_quantity"), qty_comp.get("latest_quantity")
        if prev is not None and latest is not None:
            delta = latest - prev
            pct = (delta / abs(prev) * 100) if prev else None
            paragraphs["sales_volume"] = f"Recorded quantity changed from {_money(prev)} in {qty_comp['previous_month']} to {_money(latest)} in {qty_comp['latest_month']} ({'+' if delta > 0 else ''}{_money(delta)} units{f', {pct:+.2f}%' if pct is not None else ''}). Compare this volume movement with revenue to understand whether sales value and units are moving together."
    if "sales_volume" not in paragraphs:
        paragraphs["sales_volume"] = "A comparable monthly sales-volume narrative could not be calculated from the available date and quantity fields."

    paragraphs["data_reliability"] = (f"The selected source contains {context.get('data_quality', {}).get('missing_cells', 0):,} missing cells and {context.get('data_quality', {}).get('duplicate_rows', 0):,} duplicate rows. " + " ".join(context.get("limitations", [])))
    return paragraphs

def generate_decision_report(
    dataset_id: str,
    source: str = "original",
) -> DecisionReport:
    dataframe = load_analytics_dataset(dataset_id, source)
    semantic_types = get_semantic_columns(dataset_id)

    findings = generate_findings(dataframe, semantic_types)
    business_context = build_business_context(dataset_id, source)
    business_narrative = _build_business_narrative(business_context)

    for observation in business_context.get("observations", []):
        findings.append({
            "type": "business_observation",
            "title": "Historical business performance",
            "description": observation,
            "evidence": {"source": "deterministic_business_analysis"},
        })

    evidence_text = "\n".join(
        (
            f"- {item['title']}: {item['description']}. "
            f"Evidence: {item['evidence']}"
        )
        for item in findings
    )

    prompt = f"""
You are a careful business intelligence consultant.

Analyze the verified findings from the supplied business dataset.

DATASET:
Rows: {len(dataframe)}
Columns: {len(dataframe.columns)}
Source: {source}

VERIFIED FINDINGS:
{evidence_text}

DETERMINISTIC BUSINESS METRICS:
{business_context}

Produce a concise executive decision report with these sections:

1. EXECUTIVE SUMMARY
Explain the most important findings.

2. RECOMMENDATIONS
Give 3 to 5 practical, specific business actions.
Every recommendation must connect to the supplied evidence.
If evidence is insufficient, explain what additional data is needed.

3. RISKS
Mention meaningful risks supported by the findings.

Important rules:
- Never invent numbers, products, categories, or statistics.
- Do not claim correlation proves causation.
- Do not describe a possible explanation as a proven root cause.
- Do not assume low revenue means a product should be discontinued.
- Clearly distinguish evidence from suggestions.
- If evidence is insufficient, state that.
- Use simple professional business language.
- Prioritise historical sales, revenue, quantity, category and product performance over data-cleaning commentary.
- If monthly revenue exists, compare the latest month with the previous month using the supplied values.
- Recommend stock review only when product/category quantity or sales evidence supports it. Do not invent a stock count.
- If no product field exists, give category-level recommendations only.
- Do not treat historical observations as guaranteed future outcomes.

Return exactly this format:

EXECUTIVE SUMMARY:
...

RECOMMENDATIONS:
- ...

RISKS:
- ...
"""

    limitations = [
        "Findings are based on the selected dataset and its available columns.",
        "Observational patterns do not establish causation.",
        "Recommendations require business context and human review.",
    ]

    try:
        response = generate_response(prompt)

        if not isinstance(response, str) or not response.strip():
            raise ValueError("The AI service returned an empty response.")

        sections = _parse_report_sections(response)

        summary = sections["EXECUTIVE SUMMARY:"]
        recommendations = _clean_bullet_items(
            sections["RECOMMENDATIONS:"]
        )
        risks = _clean_bullet_items(sections["RISKS:"])

        if not summary:
            summary = (
                "The dataset was analyzed, but the AI summary "
                "could not be extracted."
            )

        if not recommendations:
            recommendations = [
                (
                    "Review the verified findings and determine which "
                    "actions are appropriate for the business."
                )
            ]

        if not risks:
            risks = [
                (
                    "Review the data-quality findings and validate "
                    "the dataset before making business decisions."
                )
            ]

    except Exception:
        summary = (
            "Automated analysis completed. AI interpretation is temporarily "
            "unavailable. Review the verified findings below."
        )

        recommendations = [
            (
                "Review the verified findings and investigate any "
                "identified data-quality issues."
            )
        ]

        risks = [
            (
                "AI-generated interpretation was unavailable. "
                "Recommendations should be reviewed manually."
            )
        ]

    return DecisionReport(
        dataset_id=dataset_id,
        source=source,
        executive_summary=summary,
        business_narrative=business_narrative,
        findings=findings,
        recommendations=recommendations,
        risks=risks,
        limitations=limitations,
    )
