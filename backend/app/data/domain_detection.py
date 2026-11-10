def detect_domain(columns: list[str]) -> tuple[str, str]:
    names = {column.lower().replace(" ", "_") for column in columns}

    patterns = {
        "healthcare": {
            "patient",
            "patient_id",
            "diagnosis",
            "admission_date",
            "discharge_date",
            "department",
        },
        "retail": {
            "product",
            "product_id",
            "quantity",
            "unit_price",
            "stock",
            "inventory",
        },
        "ecommerce": {
            "order_id",
            "customer_id",
            "product_id",
            "order_date",
            "shipping",
        },
        "finance": {
            "transaction_id",
            "transaction_date",
            "balance",
            "account_id",
            "transaction_type",
        },
        "marketing": {
            "campaign",
            "campaign_id",
            "clicks",
            "impressions",
            "conversion",
        },
    }

    scores = {
        domain: len(names.intersection(keywords))
        for domain, keywords in patterns.items()
    }

    if not scores or max(scores.values()) == 0:
        return "general", "low"

    ranked = sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    best_domain, best_score = ranked[0]
    second_score = ranked[1][1]

    if best_score < 2:
        return "general", "low"

    confidence = (
        "high"
        if best_score >= 3 and best_score > second_score
        else "medium"
    )

    return best_domain, confidence