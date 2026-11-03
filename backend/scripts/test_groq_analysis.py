
from app.services.llm_service import generate_response


prompt = """
You are INSIGHT AI, an intelligent business data analyst.

A retail business has the following monthly results:

January revenue: 100000
February revenue: 120000
March revenue: 90000
April revenue: 150000

Answer:
1. Which month had the highest revenue?
2. What was the total revenue?
3. What was the average monthly revenue?
4. Give two business recommendations.

Use the supplied figures. Do not invent additional data.
"""

answer = generate_response(prompt)

print("\nINSIGHT AI BUSINESS ANALYSIS")
print("=" * 50)
print(answer)
