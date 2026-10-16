# Đơn bán — Chốt đơn và Báo thu

Mã nguồn dựa trên Sales ở nhánh `erp/sprint1-architecture-20261012`, bản triển khai ghép lên main `ba9dd8f` (giữ giao diện mới và bản sửa in kho).
Đã triển khai Sales v63 theo yêu cầu chủ; không triển khai hoặc ghi dữ liệu Finance/Kho. Mọi dữ liệu trong ảnh/test là TEST_.

## Các file bàn giao

- `DonBan.js`: toàn bộ server mới. Khi thêm thủ công trong Apps Script, tạo tệp Script tên **DonBanServer** (editor tự đặt .gs), dán nội dung file .js này.
- `DonBan.html`: toàn bộ giao diện mới, tạo tệp HTML tên **DonBan**.
- `hooks.patch`: chỉ những chỗ ghép trong code.js/Index.html; dùng `git apply --check` trước khi apply lên bản gốc cùng base. Trong checkout này đã áp dụng, không apply lần hai.

## Vị trí ghép vào code.js

Patch có context đầy đủ để tìm đúng chỗ, không thay nguyên hàm cũ:

1. Cuối `APP.SHEETS`, sau `GROUPS`: thêm ORDERS=`DON_BAN`, ORDER_LINES=`CHI_TIET_DON_BAN`, COLLECTIONS=`BAO_THU`.
2. Trong `doGet`, đổi đúng biểu thức nạp Index thành `HtmlService.createTemplateFromFile('Index').evaluate()`. Hai lệnh setTitle/setXFrameOptionsMode giữ nguyên. Cần evaluate để include HTML chạy được; createHtmlOutputFromFile cũ không xử lý scriptlet.
3. Ngay đầu `nextNo_(prefix)`: `if (prefix === 'DB' || prefix === 'BT') return donBanNextNo_(prefix);`. Chỉ command mới đang giữ ScriptLock mới gọi nhánh này. Mã DB/BT tăng bền vững, định dạng sáu chữ số; mã BG/HD theo tháng giữ nguyên. Tránh lấy lock lồng nhau và release nhầm lock ngoài.
4. `saveQuote`: sau dòng cấp `no`, thêm lock/try/finally và `donBanAssertQuoteEditable_(no)`; công thức, giá và nội dung return giữ nguyên. Lưu vị trí bắt đầu ghi dòng trong `donBanLineStart`; sau `.setValues(lines)` gọi `donBanSaveSources_(lineSheet, donBanLineStart, q.items)`.
5. `updateQuote`: dòng đầu trong try đã có lock, thêm `donBanAssertQuoteEditable_(no)`. Chèn lưu nguồn giống bước 4 sau ghi dòng hàng.
6. `cancelQuote`: bọc lock/try/finally và guard để không thể hủy báo giá đang gắn đơn bán qua API cũ. `deleteQuotePermanently`: thêm guard ở đầu try trong lock có sẵn. Không thay nghiệp vụ của báo giá chưa chốt.
7. `getQuote`: trong object dòng hàng được trả về cuối hàm, thêm `source: clean_(item.NguonHang)`. Chỉ metadata; không lấy nguồn bằng cách dò mã/tên.

Các hook lưu nguồn và guard là cần thiết để thực hiện hai yêu cầu “NguonHang theo item.source” và “báo giá đã chốt không sửa được ở server”. Không thể đạt hai yêu cầu đó chỉ bằng thêm tab/nút. Không viết lại bộ tính giá, PDF, hợp đồng.

## Vị trí ghép vào Index.html

1. Trong `<nav id="nav">`, sau nút Báo giá đã lưu: `<button data-page="donban">🛒 Đơn bán</button>`.
2. Ngay trước `</main></div>`: `<?!= includeDonBan_(); ?>`. DonBan.html tự đăng ký sự kiện cho tab, dùng cơ chế showPage hiện có; không sửa showPage.
3. Trong `renderHistory`, đầu `<div class="row-actions">` của thẻ báo giá: nút Chốt đơn, `data-db-quote` và gọi `DonBan.chot(this)` như patch. Nút khóa cho báo giá hủy/đã chốt.
4. Trong `quotePayload`, object mỗi `items`: thêm `source:item.source||''` để server thực sự nhận metadata đã có trên giỏ hàng.
5. Trong `openQuoteForEdit`, object tạo từ từng dòng đã lưu: thêm `source:item.source||''`. Báo giá cũ chưa có nguồn giữ trống; không đoán từ danh mục hàng hiện tại.

## Cài trên bản sao trước

1. Sao lưu hai file cũ và dữ liệu Sales. Thử bằng container-bound project của bản sao Sales; chưa triển khai bản thật.
2. Thêm hai file DonBan và các hook ở trên, hoặc dùng patch vào đúng base. Không thay toàn bộ Index/code bằng một bản cũ khác.
3. Trong CAU_HINH (cột Khoa/GiaTri hiện có), thêm dòng: `NHAN_VIEN_BAN_HANG` / `An, Bình, ...`. Dấu phẩy phân cách người báo. UI buộc chọn người, không cho gõ tự do.
4. Script Properties: đặt `FINANCE_DB_ID` là ID bản sao Finance để thử. Chỉ đọc sheet `KQ_SALES` với đủ 9 header trong yêu cầu. Không tạo KQ_SALES, không ghi bất cứ dữ liệu nào sang Finance/Kho. Nếu chưa cấu hình, hiện “Chưa kết nối Finance” và vẫn báo thu được. Nếu đã cấu hình mà không đọc được/sai schema/kết quả trùng hoặc không khớp báo thu, dừng thao tác tiền để tránh vượt thu; sửa cấu hình rồi thử lại.
5. Mở tab Đơn bán để tự tạo 3 sheet nếu thiếu. Header sai thì dừng, không tự sửa đè bảng đã có. DienThoai/MaSoThue/MaGiaoDichNH dùng @ trước khi ghi. Chốt một báo giá TEST_, kiểm tổng/dòng hàng giữ nguyên; báo thu rồi nhập kết quả giả trong KQ_SALES của bản sao Finance bằng tài khoản kế toán để thử đọc. Nút Làm mới bỏ cache 60 giây.

## Bảo đảm và giới hạn

- Bốn lệnh mới `chotDon`, `huyDon`, `baoThu`, `huyBaoThu` bắt buộc requestId, ScriptLock. Cùng key/nội dung trả kết quả cũ; đổi nội dung dùng lại key bị từ chối. UI giữ nguyên key khi thử lại sau mất phản hồi, khóa nút/fields khi chưa rõ kết quả.
- Journal delta tạm và checksum trong Script Properties; nếu lỗi giữa các bước, lần đọc/lệnh tiếp theo khôi phục xong trước khi xử lý. Upsert theo MaDon/STT hoặc MaBaoThu, không xóa dòng. Đổi trạng thái báo giá chỉ ghi cột trạng thái, không ghi đè giá/VAT/công thức.
- Receipt chống trùng hiện lưu bền trong sheet ẩn LENH_DON_BAN, không còn tăng Script Properties theo số lệnh. Script Properties chỉ giữ bộ đếm, journal tạm và cờ DON_BAN_SCHEMA_V1. Khóa DON_BAN_REQ_* cũ được chuyển an toàn sang sheet. Xem STORAGE_MIGRATION.md trước khi cập nhật bản này.
- Lock Sales không khóa được project Finance. Việc hủy kiểm tra KQ_SALES mới nhất, vẫn xử lý trường hợp Finance xác nhận đến sau bằng số đã thu và cảnh báo đỏ đúng yêu cầu; không tự đảo phiếu Finance.
- Quyền truy cập Sales hiện có giữ nguyên; không thêm phương thức ghi vào Finance/Kho hay tự cấp vai trò.
- Giữ lại cả báo thu bị từ chối/hủy; khi chưa cấu hình Finance không coi tiền báo là tiền đã xác nhận.

## Kiểm thử

```
node --test test/don-ban/domain.test.cjs test/don-ban/regression.test.cjs
node --test test/don-ban/browser.cjs
```

Browser dùng Playwright + Chromium có sẵn trong môi trường; có thể đặt `PLAYWRIGHT_MODULE` và `CHROMIUM_PATH` cho máy khác. Chạy full Index đã ghép DonBan, dùng RPC shim gọi chính server trong fixture Sheet TEST_, không phải Google thật.

Kết quả: **38/38 đạt** (28 ca domain, 3 regression, 7 browser). Test định dạng 1.250.000 → sửa giữa thành 1.350.000 giữ caret; dán 50,000đ; số nguyên gửi lên RPC; nguồn KHO; chọn người/phương thức; lọc không dấu/SĐT; hủy mềm; trạng thái/MA_PHIEU/lý do Finance; mất phản hồi sau khi server ghi rồi retry không trùng; fault injection giữa các ghi tạo/hủy; header/text; mọi ghi ở Sales trong lock; không ghi Finance.

Regression so sánh nguyên văn các hàm tính giá/PDF/hợp đồng với base ba9dd8f và parse mọi inline script sau include. Ảnh 390×844 nằm trong `screenshots/`: list-390.png, detail-390.png, payment-390.png. Chưa chạy các lệnh tạo đơn/thu tiền trên dữ liệu Google thật hoặc thiết bị điện thoại thật. Đã deploy và kiểm tra chỉ đọc HTML Google như bên dưới.

## Sửa theo tài liệu bước 1 trước triển khai

- `TU_CHOI` được có SO_TIEN=0; chỉ yêu cầu số tiền Finance khớp số báo khi DA_XAC_NHAN. Khoản từ chối trả lại khả năng báo thu, không tính vào đã thu hoặc đang chờ.
- MaKhachChung luôn để trống ở bước 1, kể cả hồ sơ khách đã có mã; chưa nối Danh bạ.
- 38/38 test chạy lại trên main ba9dd8f, có ca Finance từ chối 0đ và giữ nguyên hàm PDF/hợp đồng/pricing của bản mới.
- Bộ deploy chỉ nạp appsscript.json, code.js, Index.html, DonBanServer.js (copy nguyên nội dung DonBan.js), DonBan.html; không đẩy các app ERP/Điều phối/Danh bạ còn trên máy.

Google Apps Script không cho server và HTML trùng tên DonBan. Repo giữ DonBan.js; bước deploy copy chính xác sang DonBanServer.js và chỉ đẩy bản đó. HTML vẫn tên DonBan để include không đổi. Lần đầu bị Google từ chối trùng tên trước khi cập nhật deployment; bản sửa này khắc phục cách đóng gói.

## Bằng chứng triển khai 16/10/2026

- Source commit `0f4f6e9`, Sales deployment **v63**, giữ URL hiện có: https://script.google.com/macros/s/AKfycbyNT-outokhNSw6pJ6h0o35sphKGrFrYUaIx6u4KNox1lI0XhMapZyFjlZNZwj_IIcR/exec
- GitHub Actions run [38857523570](https://github.com/tinhocthanhduc-dotcom/SALE_THANHDUC/actions/runs/38857523570) thành công, Google nhận đúng 5 file và cập nhật deployment lúc 05:47:06 UTC.
- GET chỉ đọc URL triển khai trả về HTML 179.385 byte, có DonBan, include đã được evaluate, không có ReferenceError/SyntaxError trong HTML trả về. Không thực hiện lệnh chốt đơn/báo thu trên sổ thật để kiểm thử.
- 38/38 test local đạt; thêm regression chống trùng tên file GAS sau sự cố đóng gói đầu tiên.
- Cần điền `NHAN_VIEN_BAN_HANG` trong CAU_HINH trước khi chọn người báo. Thẻ B “Nhận từ Sales” bên Finance chưa triển khai trong việc này.

## Bản sửa lưu receipt và đường đọc (chưa deploy)

50/50 test local đạt: giữ 38 ca trước, thêm 12 ca storage/migration/read. Thay đổi runtime chỉ ở DonBan.js; code.js, Index.html và DonBan.html không đổi. Chi tiết và cách chuyển dữ liệu ở [STORAGE_MIGRATION.md](STORAGE_MIGRATION.md). Deployment v63 phía trên là bản trước sửa này.
