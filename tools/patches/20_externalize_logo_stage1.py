from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

# 1) Ensure normal app loads migrate the embedded logo to Drive once.
old_do_get = """function doGet() {\n  return HtmlService.createHtmlOutputFromFile('Index')\n"""
new_do_get = """function doGet() {\n  ensureExternalLogo_();\n\n  return HtmlService.createHtmlOutputFromFile('Index')\n"""
if old_do_get in text and 'ensureExternalLogo_();\n\n  return HtmlService' not in text:
    text = text.replace(old_do_get, new_do_get, 1)

# 2) Replace direct Base64-only logo getter with Drive-backed storage.
old_logo = """function getLogoBlob_() {\n  return Utilities.newBlob(\n    Utilities.base64Decode(APP_LOGO_BASE64),\n    'image/jpeg',\n    'logo-thanh-duc.jpg'\n  );\n}\n"""
new_logo = """function ensureExternalLogo_() {\n  const properties = PropertiesService.getScriptProperties();\n  const configuredId = clean_(cfg_().LOGO_FILE_ID);\n  const storedId = clean_(\n    properties.getProperty('THANH_DUC_LOGO_FILE_ID')\n  );\n\n  const existingId = configuredId || storedId;\n\n  if (existingId) {\n    try {\n      const file = DriveApp.getFileById(existingId);\n      if (!file.isTrashed()) {\n        if (!storedId) {\n          properties.setProperty(\n            'THANH_DUC_LOGO_FILE_ID',\n            existingId\n          );\n        }\n        return existingId;\n      }\n    } catch (error) {\n      if (!configuredId) {\n        properties.deleteProperty(\n          'THANH_DUC_LOGO_FILE_ID'\n        );\n      }\n    }\n  }\n\n  if (\n    typeof APP_LOGO_BASE64 === 'undefined' ||\n    !clean_(APP_LOGO_BASE64)\n  ) {\n    throw new Error(\n      'Chưa có LOGO_FILE_ID và logo nhúng đã được loại bỏ.'\n    );\n  }\n\n  const root = getStorageRootFolder_();\n  const assets = getOrCreateChildFolder_(root, 'ASSETS');\n  const fileName = 'logo-thanh-duc.jpg';\n  const files = assets.getFilesByName(fileName);\n\n  let file;\n  if (files.hasNext()) {\n    file = files.next();\n  } else {\n    const blob = Utilities.newBlob(\n      Utilities.base64Decode(APP_LOGO_BASE64),\n      'image/jpeg',\n      fileName\n    );\n    file = assets.createFile(blob);\n  }\n\n  properties.setProperty(\n    'THANH_DUC_LOGO_FILE_ID',\n    file.getId()\n  );\n\n  return file.getId();\n}\n\nfunction getLogoBlob_() {\n  return DriveApp\n    .getFileById(ensureExternalLogo_())\n    .getBlob()\n    .setName('logo-thanh-duc.jpg');\n}\n\nfunction getLogoDataUrl_() {\n  const blob = getLogoBlob_();\n  const mimeType = clean_(blob.getContentType()) || 'image/jpeg';\n\n  return (\n    'data:' +\n    mimeType +\n    ';base64,' +\n    Utilities.base64Encode(blob.getBytes())\n  );\n}\n"""
if old_logo in text:
    text = text.replace(old_logo, new_logo, 1)
elif 'function ensureExternalLogo_()' not in text:
    raise SystemExit('Could not find getLogoBlob_() for logo migration patch')

# 3) Route all HTML previews/PDF HTML through the external logo helper.
old_logo_data = """  const logoData =\n    'data:image/jpeg;base64,' +\n    APP_LOGO_BASE64;\n"""
text = text.replace(old_logo_data, "  const logoData = getLogoDataUrl_();\n")

path.write_text(text, encoding='utf-8')
print('Applied stage 1 logo externalization: Drive-backed logo with automatic migration.')
