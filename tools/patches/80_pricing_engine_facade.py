from pathlib import Path
import re

code_path = Path('code.js')
html_path = Path('Index.html')
code = code_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

# Backend: one stable pricing-engine facade. Existing calculation functions remain
# unchanged so numerical behaviour is preserved exactly.
backend_engine = """
function pricingEngine_() {
  return {
    normalizeMode: normalizeQuoteTaxMode_,
    modeLabel: quoteTaxModeLabel_,
    resolveItemTax: resolveItemTax_,
    inferSavedMode: inferSavedQuoteTaxMode_,
    calculateItem: calculateItemPricing_,
    calculateQuote: calculateQuotePricing_
  };
}

"""
if 'function pricingEngine_()' not in code:
    anchor = 'function migrateQuoteTotalsToNet_() {'
    if anchor not in code:
        raise SystemExit('Backend pricing engine anchor not found')
    code = code.replace(anchor, backend_engine + anchor, 1)

# Route all business call sites through the facade while leaving function
# declarations untouched. The underlying formulas are not changed.
backend_calls = {
    'normalizeQuoteTaxMode_': 'pricingEngine_().normalizeMode',
    'quoteTaxModeLabel_': 'pricingEngine_().modeLabel',
    'resolveItemTax_': 'pricingEngine_().resolveItemTax',
    'inferSavedQuoteTaxMode_': 'pricingEngine_().inferSavedMode',
    'calculateItemPricing_': 'pricingEngine_().calculateItem',
    'calculateQuotePricing_': 'pricingEngine_().calculateQuote',
}
for old, new in backend_calls.items():
    pattern = rf'(?<!function )\b{re.escape(old)}\('
    code = re.sub(pattern, new + '(', code)

# Frontend: mirror the same abstraction so all UI calculations flow through
# one pricing-engine object instead of scattered direct helper calls.
frontend_engine = """
const PRICING_ENGINE = Object.freeze({
  normalizeMode: normalizeQuoteTaxMode,
  modeLabel: quoteTaxModeLabel,
  resolveItemTax: resolveItemTax,
  calculateItem: calculateItemPricing
});

"""
if 'const PRICING_ENGINE = Object.freeze({' not in html:
    anchor = 'function normalizeQuoteTaxMode(mode){'
    if anchor not in html:
        raise SystemExit('Frontend pricing engine anchor not found')
    html = html.replace(anchor, frontend_engine + anchor, 1)

frontend_calls = {
    'normalizeQuoteTaxMode': 'PRICING_ENGINE.normalizeMode',
    'quoteTaxModeLabel': 'PRICING_ENGINE.modeLabel',
    'resolveItemTax': 'PRICING_ENGINE.resolveItemTax',
    'calculateItemPricing': 'PRICING_ENGINE.calculateItem',
}
for old, new in frontend_calls.items():
    pattern = rf'(?<!function )\b{re.escape(old)}\('
    html = re.sub(pattern, new + '(', html)

code_path.write_text(code, encoding='utf-8')
html_path.write_text(html, encoding='utf-8')
print('Centralized VAT/pricing call sites behind backend and frontend pricing-engine facades.')
