from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

old_customer = """  const customer = rows_(APP.SHEETS.CUSTOMERS)
    .find(x => clean_(x.MaKhachHang) === id);
"""
new_customer = """  const customer = findObjectByValue_(
    APP.SHEETS.CUSTOMERS,
    'MaKhachHang',
    id
  );
"""
if old_customer in text:
    text = text.replace(old_customer, new_customer, 1)

old_products = """  const productMap = {};

  rows_(APP.SHEETS.PRODUCTS)
    .forEach(product => {
      productMap[
        clean_(product.MaSanPham)
      ] = product;
    });
"""
new_products = """  const productMap = {};
  const productCodes = {};

  (items || []).forEach(item => {
    const code = clean_(item.code);
    if (code) productCodes[code] = true;
  });

  Object.keys(productCodes).forEach(code => {
    const product = findObjectByValue_(
      APP.SHEETS.PRODUCTS,
      'MaSanPham',
      code
    );

    if (product) productMap[code] = product;
  });
"""
if old_products in text:
    text = text.replace(old_products, new_products, 1)

path.write_text(text, encoding='utf-8')
print('Optimized principle-contract customer lookup and contract product lookups.')
