# Sprint 1 — Công việc và nghiệm thu
## Đã hoàn tất
- Kiểm toán tĩnh 5 repository, chốt commit; đối chiếu adapter và namespace sản phẩm.
- Lập danh sách rủi ro, mô hình dữ liệu, contract tích hợp, triển khai staging và migration PostgreSQL.
- Kiểm tra cú pháp 24 JS và inventory tĩnh; bằng chứng evidence.json/snapshots.json.
- Không sửa runtime hiện hành; hồ sơ đề xuất được đưa lên branch/PR riêng để duyệt.

## Backlog triển khai kế tiếp
| ID | Công việc/đầu ra | Phụ thuộc | Người chịu trách nhiệm đề xuất | Điều kiện hoàn tất |
|---|---|---|---|---|
| D01 | Xác nhận workbook runtime của Sale, Care property override và headers thực tế của 5 nguồn | quyền đọc hoặc export schema ẩn dữ liệu | chủ app + quản trị | source registry đầy đủ, không suy đoán từ config |
| D02 | Duyệt chủ quản khách/nhân viên, cấp SKU, chính sách ghi doanh thu/đơn và đổi trả | quyết định vận hành | anh Tuấn + kinh doanh + tài chính | ghi rõ người duyệt và thời điểm áp dụng |
| D03 | Mẫu dữ liệu ẩn danh, danh sách product mapping và bản ghi mơ hồ | D01/D02 | kho + sale | mỗi dòng có approved/unmapped/conflict; không tự gộp |
| I01 | GAS/Sheets staging riêng và Auth/RBAC | phê duyệt môi trường | phát triển | không trỏ production; truy cập trái quyền bị chặn server |
| I02 | Adapter read-only 5 nguồn + kiểm schema | D01/I01 | phát triển | sai header/downtime trả issue; không ghi/migrate |
| I03 | Master/external_keys, schema và export contract | D02/D03 | phát triển | UUID ổn định, khóa nguồn unique, FK được kiểm |
| I04 | Order/work service, history và trạng thái | I03 | phát triển + kỹ thuật | giao việc, testing, bàn giao đúng transition |
| I05 | Inbox/outbox/checkpoint/recovery staging | I04 | phát triển | replay no-op, crash recovery, version conflict đúng |
| I06 | Read projection Kho/Finance và báo cáo | I02/I05 | kho + tài chính | doanh thu, công nợ, thu tiền tách và đối chiếu |
| I07 | Pilot và cutover proposal | I01–I06 | chủ nghiệp vụ | UAT ký duyệt; chưa deploy production trước phê duyệt |

## Tiêu chí nghiệm thu thiết kế Sprint 1
PASS: 5 nguồn có bằng chứng commit, cấu trúc đọc và phát hiện riêng; mô hình sản phẩm được đối chiếu; thiết kế chung và PostgreSQL mapping; contract event/command/query, xử lý retry và recovery; backlog, ca nghiệm thu và gate vận hành. Static syntax PASS không thay thế UAT. Chưa nghiệm thu bản ERP chạy được.

## Ca kiểm thử bắt buộc ở staging (chưa chạy)
| Ca | Fixture/hành động | Kết quả phải đạt |
|---|---|---|
| A01 Read-only | mock SpreadsheetApp chỉ cho getRange/getValues; setters throw; gọi toàn bộ adapter | 0 write; không gọi legacy bootstrap/setup/migrate |
| A02 Schema | thiếu/đổi/duplicate header và khác bố cục Kho 145 | SCHEMA_MISMATCH, không trả tồn giả |
| A03 Product mapping | cùng TD-xxxx ở hai nguồn nhưng khác chip/hãng/variant; một mã nguồn map hai product | CONFLICT/quarantine; không auto merge |
| A04 Customer | cùng điện thoại khác MST, tên viết tắt, thiếu ID | candidate duyệt; không hợp nhất tự động |
| A05 FK | order line thiếu product, task thiếu assignee | reject, không tạo orphan |
| A06 Workflow | bỏ qua testing, hoàn tất thiếu in thử/bàn giao, hủy đơn đã xuất | reject hoặc workflow đảo có duyệt |
| A07 Idempotency | gửi cùng key/hash 2 lần, key giống/hash khác | một tác động; CONFLICT cho payload khác |
| A08 Concurrency | hai người cập nhật cùng version | một thành công, một VERSION_CONFLICT |
| A09 Recovery | lỗi sau journal, sau ghi line, trước checkpoint/outbox | RECOVERY_REQUIRED, retry không nhân đôi; reconciliation hết sai lệch |
| A10 Finance | báo giá 1 triệu, chưa giao/chưa thu; bàn giao chưa thu; thu từng phần | không gộp doanh thu với tiền thu; tổng phân bổ không vượt payment/chứng từ |
| A11 Source down | đọc Kho/Finance bị lỗi, cache stale | UNAVAILABLE + as_of; qty/amount không tự thành 0 |
| A12 Authorization | role kỹ thuật gọi ghi tiền; user giả actor_id | server deny; không write; không lộ dữ liệu tài chính |
| A13 Transfer/reversal | chuyển giữa 58/145, retry vế hai, đảo giao dịch | hai vế liên kết, không trừ/nhập lặp, không xóa lịch sử |
| A14 Migration | export/import fixture UUID, decimal, điện thoại 0 đầu | checksum/row_count/FK/số dư khớp; UUID giữ nguyên |
| A15 Hiệu năng | 1.300 khách + tập đơn/kho đại diện được duyệt | đo thời gian/batch và giới hạn thực tế, chốt ngưỡng SLA trước pilot |

## Việc cần phê duyệt
1. PR hồ sơ thiết kế; merge tài liệu không đồng nghĩa cho phép triển khai production.
2. Danh mục Kho 58 làm master cho hàng vật lý; dịch vụ do Sale tạo; product mapping cần người phụ trách duyệt.
3. Chủ quản khách hàng/nhân viên, quy tắc cấp số đơn và chứng cứ ghi doanh thu quản trị; Finance giữ quyền xác nhận thu tiền/chứng từ.
4. Tạo môi trường staging riêng và cung cấp workbook Sale/runtime properties hoặc export headers + mẫu ẩn danh. Chỉ cần quyền đọc nếu shadow-read; không cần cấp quyền ghi production.

## Chưa làm và rủi ro còn lại
Chưa đọc số liệu thực tế nên chưa đếm được số hàng/khách trùng, chưa xác nhận orphan hay số dư. Chưa chạy ERP, UAT, benchmark, shadow-read hoặc migration. Cấu hình source và code GitHub có thể khác bản Apps Script triển khai. Quyền anonymous trong manifest cần kiểm authorization thực tế; không tự đổi quyền. Hai project cùng ghi Kho 145 là rủi ro concurrency cần chốt chủ quản trước pilot. Không sửa lỗi tài chính hoặc chứng từ chỉ dựa trên kiểm toán tĩnh.

## Quyết định đã duyệt — 12/10/2026
Người duyệt: anh Tuấn (xác nhận trong phiên làm việc: “chốt nguyên tắc”).

1. Kho 58 là danh mục chuẩn cho hàng vật lý; Sale quản lý dịch vụ. Ánh xạ mã Sale/Kho phải rõ ràng và được duyệt, không ghép theo tên.
2. ERP giữ danh mục khách hàng và nhân viên chung, liên kết mã hiện có từ Sale–Care–Finance. Không tự hợp nhất bản ghi mơ hồ.
3. Hoàn thành công việc tạo đề nghị ghi doanh thu; Finance xác nhận. Tiền đã thu được theo dõi riêng.

Các quyết định này cho phép thiết kế/viết mã thử nghiệm theo nguyên tắc trên; không cho phép ghi dữ liệu production, đổi quyền, merge PR hay deploy production. Quy tắc cấp số đơn, người duyệt mapping cụ thể và xử lý đổi trả vẫn cần đặc tả; không coi là đã duyệt toàn bộ D02.

Kiểm tra nguồn bước đầu: đã tìm thấy metadata Sheets Kho 58, Kho 145, Sale, Care và Finance qua Google Drive. File Sale có tên THANH_DUC_SALES_APP_DATABASE; chưa xác nhận đây là workbook gắn với deployment hiện hành. Chưa đọc headers hoặc Script Properties runtime trong bước này.
