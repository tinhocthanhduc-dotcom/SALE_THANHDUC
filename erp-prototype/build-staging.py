"""Build a standalone GAS source outside the legacy project. Does not push/deploy."""
from pathlib import Path
import argparse
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
args = parser.parse_args()
dest = args.destination.resolve()
if dest == root or root in dest.parents:
    raise SystemExit('Choose an isolated output directory outside the source project.')
dest.mkdir(parents=True, exist_ok=True)
parts = []
for file, name in [('read-adapter.cjs', 'ErpReader'), ('order-work.cjs', 'ErpDomain'), ('product-mapping.cjs', 'ErpMapping'), ('sheets-repository.cjs', 'ErpSheets')]:
    source = (root / file).read_text()
    source = source.replace("const Domain=require('./order-work.cjs');", 'const Domain=ErpDomain;')
    source = source.replace('module.exports=', 'return ')
    parts.append('var ' + name + ' = (function(){\n' + source + '\n})();')
parts.append((root / 'staging-entry.gs.txt').read_text())
(dest / 'Code.gs').write_text('\n\n'.join(parts))
print(dest / 'Code.gs')
