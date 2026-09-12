from pathlib import Path
import re

code_path = Path('code.js')
index_path = Path('Index.html')
code = code_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')

# =========================================================
# 1) FINALIZE LOGO EXTERNALIZATION
# =========================================================
# Remove the large embedded Base64 constant from server source.
code, removed_server_logo = re.subn(
    r"^const APP_LOGO_BASE64 = '[^\n]*';\n+",
    '',
    code,
    count=1,
    flags=re.MULTILINE,
)

# Do not touch Drive on every page load. Logo is only needed when generating
# previews/PDFs/documents, so resolve it lazily at that point.
code = code.replace(
    "function doGet() {\n  ensureExternalLogo_();\n\n  return HtmlService.createHtmlOutputFromFile('Index')",
    "function doGet() {\n  return HtmlService.createHtmlOutputFromFile('Index')",
    1,
)

# Replace migration-era resolver with a permanent Drive-backed resolver.
logo_pattern = re.compile(
    r"function ensureExternalLogo_\(\) \{.*?\n\}\n\nfunction getLogoBlob_\(\)",
    re.DOTALL,
)
logo_resolver = r"""function ensureExternalLogo_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredId = clean_(cfg_().LOGO_FILE_ID);
  const storedId = clean_(
    properties.getProperty('THANH_DUC_LOGO_FILE_ID')
  );

  const candidates = [configuredId, storedId].filter(Boolean);

  for (let index = 0; index < candidates.length; index++) {
    try {
      const file = DriveApp.getFileById(candidates[index]);
      if (!file.isTrashed()) {
        properties.setProperty(
          'THANH_DUC_LOGO_FILE_ID',
          file.getId()
        );
        return file.getId();
      }
    } catch (error) {
      // Thử nguồn tiếp theo.
    }
  }

  /*
   * Fallback an toàn: tìm logo đã được migrate trong ASSETS.
   * Nhờ vậy Script Property bị mất vẫn có thể tự phục hồi.
   */
  const root = getStorageRootFolder_();
  const assets = getOrCreateChildFolder_(root, 'ASSETS');
  const files = assets.getFilesByName('logo-thanh-duc.jpg');

  if (files.hasNext()) {
    const file = files.next();
    properties.setProperty(
      'THANH_DUC_LOGO_FILE_ID',
      file.getId()
    );
    return file.getId();
  }

  throw new Error(
    'Không tìm thấy logo Thành Đức trên Drive. ' +
    'Hãy cấu hình LOGO_FILE_ID trong CAU_HINH.'
  );
}

function getLogoBlob_()"""
code, logo_replaced = logo_pattern.subn(logo_resolver, code, count=1)
if not logo_replaced:
    raise SystemExit('Could not replace ensureExternalLogo_()')

# =========================================================
# 2) LIGHTER BOOTSTRAP + LAZY HISTORY
# =========================================================
old_bootstrap_tail = """  return {
    customers: customers,
    products: products,
    groups: getProductGroups_(),
    quotes: listQuotes({limit: 1000}),
    contracts: getRecentContracts(20),
    config: cfg_()
  };
}"""
new_bootstrap_tail = """  return {
    customers: customers,
    products: products,
    groups: getProductGroups_(),
    /* Báo giá/hợp đồng chỉ tải khi mở trang lịch sử. */
    quotes: [],
    contracts: [],
    config: cfg_()
  };
}"""
if old_bootstrap_tail in code:
    code = code.replace(old_bootstrap_tail, new_bootstrap_tail, 1)
elif "quotes: [],\n    contracts: []" not in code:
    raise SystemExit('Could not patch bootstrap() history payload')

# Add one RPC for lazy history loading.
if 'function getHistoryData(' not in code:
    marker = "function getRecentQuotes(limit) {\n"
    pos = code.find(marker)
    if pos < 0:
        raise SystemExit('Could not find getRecentQuotes() insertion point')
    history_fn = """function getHistoryData(limit) {
  const quoteLimit = Math.max(
    20,
    Math.min(Number(limit || 200), 1000)
  );

  return {
    quotes: listQuotes({limit: quoteLimit}),
    contracts: getRecentContracts(20)
  };
}

"""
    code = code[:pos] + history_fn + code[pos:]

# =========================================================
# 3) REMOVE UNUSED FRONTEND BASE64 + LAZY CLIENT LOAD
# =========================================================
index, removed_client_logo = re.subn(
    r"^const APP_LOGO_DATA_URI='data:image/jpeg;base64,[^\n]*';\n",
    '',
    index,
    count=1,
    flags=re.MULTILINE,
)

# Add lazy-load state.
old_db = "let DB={customers:[],products:[],groups:[],quotes:[],contracts:[],config:{}};\n"
new_db = old_db + "let historyLoaded=false;\nlet historyLoading=false;\n"
if old_db in index and 'let historyLoaded=' not in index:
    index = index.replace(old_db, new_db, 1)

# Allow a caller-specific failure handler while preserving old behavior.
old_run = """function run(name,args,ok){
  google.script.run
    .withSuccessHandler(ok)
    .withFailureHandler(e=>toast(e.message||String(e)))[name](...(args||[]));
}"""
new_run = """function run(name,args,ok,fail){
  google.script.run
    .withSuccessHandler(ok)
    .withFailureHandler(e=>{
      if(typeof fail==='function'){
        fail(e);
      }else{
        toast(e.message||String(e));
      }
    })[name](...(args||[]));
}"""
if old_run in index:
    index = index.replace(old_run, new_run, 1)
elif 'function run(name,args,ok,fail)' not in index:
    raise SystemExit('Could not patch run()')

# Add lazy history loader just before showPage().
if 'function loadHistoryData(' not in index:
    show_marker = 'function showPage(pageId){\n'
    pos = index.find(show_marker)
    if pos < 0:
        raise SystemExit('Could not find showPage()')
    loader = """function loadHistoryData(force=false){
  if(historyLoading) return;

  if(historyLoaded && !force){
    renderHistory();
    return;
  }

  historyLoading=true;

  run(
    'getHistoryData',
    [200],
    data=>{
      DB.quotes=Array.isArray(data?.quotes)?data.quotes:[];
      DB.contracts=Array.isArray(data?.contracts)?data.contracts:[];
      historyLoaded=true;
      historyLoading=false;
      renderHistory();
    },
    error=>{
      historyLoading=false;
      toast(error?.message||String(error));
    }
  );
}

"""
    index = index[:pos] + loader + index[pos:]

# Opening history now triggers data fetch only when needed.
index = index.replace(
    "  }else if(pageId==='history'){\n    renderHistory();\n",
    "  }else if(pageId==='history'){\n    loadHistoryData();\n",
    1,
)

# Refresh reloads lightweight core data and invalidates history cache.
old_refresh = """function refresh(showToast=true){
  run('bootstrap',[],d=>{
    DB=d;
    renderAll();
    setDefaultValidDate();
    if(showToast) toast('Đã cập nhật');
  });
}"""
new_refresh = """function refresh(showToast=true){
  run('bootstrap',[],d=>{
    DB=d;
    historyLoaded=false;
    historyLoading=false;
    renderAll();
    setDefaultValidDate();
    if(showToast) toast('Đã cập nhật');
  });
}"""
if old_refresh in index:
    index = index.replace(old_refresh, new_refresh, 1)
elif 'historyLoaded=false;' not in index[index.find('function refresh'):index.find('function refresh') + 300]:
    raise SystemExit('Could not patch refresh()')

code_path.write_text(code, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')

print(
    'Applied logo cleanup + lazy bootstrap/history. '
    f'Removed server logo={removed_server_logo}, client logo={removed_client_logo}.'
)
