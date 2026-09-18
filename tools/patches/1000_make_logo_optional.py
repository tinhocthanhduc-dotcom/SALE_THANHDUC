from pathlib import Path

path = Path("code.js")
text = path.read_text(encoding="utf-8")

old_blob = """function getLogoBlob_() {
  return DriveApp
    .getFileById(ensureExternalLogo_())
    .getBlob()
    .setName('logo-thanh-duc.jpg');
}

function getLogoDataUrl_() {
  const blob = getLogoBlob_();
  const mimeType = clean_(blob.getContentType()) || 'image/jpeg';

  return (
    'data:' +
    mimeType +
    ';base64,' +
    Utilities.base64Encode(blob.getBytes())
  );
}
"""

new_blob = """function getLogoBlob_() {
  try {
    const fileId = ensureExternalLogo_();

    if (!fileId) {
      return null;
    }

    return DriveApp
      .getFileById(fileId)
      .getBlob()
      .setName('logo-thanh-duc.jpg');
  } catch (error) {
    console.warn(
      'Logo Thành Đức chưa được cấu hình: ' +
      (error && error.message ? error.message : error)
    );

    return null;
  }
}

function getLogoDataUrl_() {
  const blob = getLogoBlob_();

  if (!blob) {
    return (
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
      )
    );
  }

  const mimeType = clean_(blob.getContentType()) || 'image/jpeg';

  return (
    'data:' +
    mimeType +
    ';base64,' +
    Utilities.base64Encode(blob.getBytes())
  );
}
"""

if "Logo Thành Đức chưa được cấu hình:" not in text:
    if old_blob not in text:
        raise SystemExit("Expected logo helper block not found")
    text = text.replace(old_blob, new_blob, 1)

old_image = """  const image = logoCell.appendImage(
    getLogoBlob_()
  );

  image.setWidth(88);
  image.setHeight(96);

  logoCell.setVerticalAlignment(
    DocumentApp.VerticalAlignment.CENTER
  );
"""

new_image = """  const logoBlob = getLogoBlob_();

  if (logoBlob) {
    const image = logoCell.appendImage(
      logoBlob
    );

    image.setWidth(88);
    image.setHeight(96);
  }

  logoCell.setVerticalAlignment(
    DocumentApp.VerticalAlignment.CENTER
  );
"""

if "const logoBlob = getLogoBlob_();" not in text:
    if old_image not in text:
        raise SystemExit("Expected company header logo block not found")
    text = text.replace(old_image, new_image, 1)

path.write_text(text, encoding="utf-8")
print("Made logo optional so quote/warehouse documents still work without LOGO_FILE_ID")
