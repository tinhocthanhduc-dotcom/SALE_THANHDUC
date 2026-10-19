from pathlib import Path
import argparse
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('destination',type=Path)
a=parser.parse_args()
domain=(root/'order-work.cjs').read_text().replace('module.exports=','return ').replace("const Field=require('./field-operations.cjs');",'const Field=ErpField;')
field=(root/'field-operations.cjs').read_text().replace('module.exports=','return ')
domain='var ErpField=(function(){\n'+field+'\n})();\n'+'var ErpDomain=(function(){\n'+domain+'\n})();'
app=(root/'ui/app.js.txt').read_text().replace('/*FIELD_PANELS*/',(root/'ui/field-panels.js.txt').read_text())
html=(root/'ui/index.html.txt').read_text().replace('/*DOMAIN*/',domain.replace('</script','<\\/script')).replace('/*APP*/',app.replace('</script','<\\/script'))
a.destination.parent.mkdir(parents=True,exist_ok=True)
a.destination.write_text(html)
print(a.destination.resolve())
