from pathlib import Path

code_path = Path('code.js')
html_path = Path('Index.html')
code = code_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

# Backend mode metadata lives next to the pricing engine. This does not alter
# any pricing formula; it only centralizes repeated interpretation of VAT mode.
if 'function quoteTaxModeInfo_(' not in code:
    anchor = 'function pricingEngine_() {'
    helper = """function quoteTaxModeInfo_(mode) {
  const normalized = normalizeQuoteTaxMode_(mode);
  const noVat = normalized === 'NO_VAT';
  const included =
    normalized === 'INCLUDED_8' ||
    normalized === 'INCLUDED_10';
  const rate = noVat
    ? 0
    : (normalized.indexOf('10') >= 0 ? 0.1 : 0.08);

  return {
    mode: normalized,
    noVat: noVat,
    included: included,
    rate: rate,
    ratePercent: Math.round(rate * 100)
  };
}

"""
    if anchor not in code:
        raise SystemExit('Backend pricingEngine_ not found; run patch 80 first')
    code = code.replace(anchor, helper + anchor, 1)

old_backend = """    normalizeMode: normalizeQuoteTaxMode_,
    modeLabel: quoteTaxModeLabel_,
    resolveItemTax: resolveItemTax_,
"""
new_backend = """    normalizeMode: normalizeQuoteTaxMode_,
    modeInfo: quoteTaxModeInfo_,
    modeLabel: quoteTaxModeLabel_,
    resolveItemTax: resolveItemTax_,
"""
if old_backend in code and 'modeInfo: quoteTaxModeInfo_' not in code:
    code = code.replace(old_backend, new_backend, 1)

# Frontend mode metadata helper. Existing UI markup and values are unchanged.
if 'function quoteTaxModeInfo(mode)' not in html:
    anchor = 'const PRICING_ENGINE = Object.freeze({'
    helper = """function quoteTaxModeInfo(mode){
  const normalized=normalizeQuoteTaxMode(mode);
  const noVat=normalized==='NO_VAT';
  const included=[
    'INCLUDED_8',
    'INCLUDED_10'
  ].includes(normalized);
  const ratePercent=noVat
    ?0
    :(normalized.includes('10')?10:8);

  return {
    mode:normalized,
    noVat,
    included,
    rate:ratePercent/100,
    ratePercent
  };
}

"""
    if anchor not in html:
        raise SystemExit('Frontend PRICING_ENGINE not found; run patch 80 first')
    html = html.replace(anchor, helper + anchor, 1)

old_frontend = """  normalizeMode: normalizeQuoteTaxMode,
  modeLabel: quoteTaxModeLabel,
  resolveItemTax: resolveItemTax,
"""
new_frontend = """  normalizeMode: normalizeQuoteTaxMode,
  modeInfo: quoteTaxModeInfo,
  modeLabel: quoteTaxModeLabel,
  resolveItemTax: resolveItemTax,
"""
if old_frontend in html and 'modeInfo: quoteTaxModeInfo' not in html:
    html = html.replace(old_frontend, new_frontend, 1)

# Replace repeated render-only mode interpretation with engine metadata.
old_ui = """  const includedMode=[
    'INCLUDED_8',
    'INCLUDED_10'
  ].includes(taxMode);

  const noVatMode=taxMode==='NO_VAT';
  const vatRate=taxMode.includes('10')?10:(noVatMode?0:8);
"""
new_ui = """  const modeInfo=PRICING_ENGINE.modeInfo(taxMode);
  const includedMode=modeInfo.included;
  const noVatMode=modeInfo.noVat;
  const vatRate=modeInfo.ratePercent;
"""
if old_ui in html:
    html = html.replace(old_ui, new_ui, 1)

code_path.write_text(code, encoding='utf-8')
html_path.write_text(html, encoding='utf-8')
print('Centralized VAT mode metadata in backend/frontend pricing engines.')
