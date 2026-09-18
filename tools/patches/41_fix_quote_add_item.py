from pathlib import Path

INDEX = Path("Index.html")
text = INDEX.read_text(encoding="utf-8")

if "let quotePickerItems=[];" not in text:
    text = text.replace(
        "let quoteItems=[];\n",
        "let quoteItems=[];\nlet quotePickerItems=[];\n",
        1
    )

old = """function renderProductPicker(){
  const keyword=norm(
    document.getElementById('productSearch').value
  );

  const group=
    document.getElementById('quoteGroupFilter')
      ?.value||'';

  document.getElementById('productPicker').innerHTML=
    DB.products
      .filter(product =>
        (!keyword||norm(
          product.code+' '+product.name
        ).includes(keyword)) &&
        (!group||product.group===group)
      )
      .slice(0,250)
      .map(product=>`<tr>
        <td>${esc(product.code)}</td>
        <td>
          <b>${esc(product.name)}</b>
          ${product.group
            ?`<br><small>${esc(product.group)}</small>`
            :''}
        </td>
        <td>${esc(product.unit)}</td>
        <td class="right">
          ${Number(product.price||0)>0
            ?money(product.price)
            :'<span class="price-missing">Chưa có giá</span>'}
        </td>
        <td>
          <button onclick="addItem('${esc(product.code)}')">
            Thêm
          </button>
        </td>
      </tr>`)
      .join('')||
      '<tr><td colspan="5">Không có sản phẩm phù hợp.</td></tr>';
}

function addItem(code){
  const p=DB.products.find(x=>x.code===code);
  if(!p){toast('Không tìm thấy sản phẩm.');return;}
  if(Number(p.price||0)===0){
    const proceed=confirm('Sản phẩm "'+p.name+'" chưa có giá bán.\\n\\nVẫn thêm với giá 0 để nhập giá thủ công?');
    if(!proceed)return;
  }
  const current=quoteItems.find(x=>x.code===code);
  if(current)current.qty+=1;else quoteItems.push({...p,qty:1,lineDiscount:0,price:Number(p.price||0)});
  renderQuoteCart();
}
"""

new = """function renderProductPicker(){
  const keyword=norm(
    document.getElementById('productSearch').value
  );

  const group=
    document.getElementById('quoteGroupFilter')
      ?.value||'';

  quotePickerItems=(DB.products||[])
    .filter(product =>
      (!keyword||norm(
        product.code+' '+product.name
      ).includes(keyword)) &&
      (!group||product.group===group)
    )
    .slice(0,250);

  document.getElementById('productPicker').innerHTML=
    quotePickerItems
      .map((product,index)=>`<tr>
        <td>${esc(product.code)}</td>
        <td>
          <b>${esc(product.name)}</b>
          ${product.group
            ?`<br><small>${esc(product.group)}</small>`
            :''}
        </td>
        <td>${esc(product.unit)}</td>
        <td class="right">
          ${Number(product.price||0)>0
            ?money(product.price)
            :'<span class="price-missing">Chưa có giá</span>'}
        </td>
        <td>
          <button type="button" onclick="addPickerItem(${index})">
            Thêm
          </button>
        </td>
      </tr>`)
      .join('')||
      '<tr><td colspan="5">Không có sản phẩm phù hợp.</td></tr>';
}

function addPickerItem(index){
  const p=quotePickerItems[index];
  if(!p){
    toast('Không tìm thấy sản phẩm trong danh sách hiện tại.');
    return;
  }
  addItem(p.code);
}

function addItem(code){
  try{
    const p=(DB.products||[]).find(
      x=>String(x.code)===String(code)
    );

    if(!p){
      toast('Không tìm thấy sản phẩm.');
      return;
    }

    if(Number(p.price||0)===0){
      const proceed=confirm(
        'Sản phẩm "'+p.name+
        '" chưa có giá bán.\\n\\n'+
        'Vẫn thêm với giá 0 để nhập giá thủ công?'
      );
      if(!proceed)return;
    }

    const current=quoteItems.find(
      x=>String(x.code)===String(code)
    );

    if(current){
      current.qty=Number(current.qty||0)+1;
    }else{
      quoteItems.push({
        ...p,
        qty:1,
        lineDiscount:0,
        price:Number(p.price||0)
      });
    }

    renderQuoteCart();
  }catch(error){
    console.error('addItem failed',error);
    toast(
      'Không thêm được sản phẩm: '+
      (error?.message||String(error))
    );
  }
}
"""

if "function addPickerItem(index)" not in text:
    if old not in text:
        raise SystemExit("Expected product picker block not found")
    text = text.replace(old, new, 1)

if "setDefaultQuoteDate();" not in text:
    text = text.replace(
        "    renderAll();\n    setDefaultValidDate();",
        "    renderAll();\n    setDefaultQuoteDate();\n    setDefaultValidDate();",
        1
    )

INDEX.write_text(text, encoding="utf-8")
print("Applied robust quote item picker fix")
