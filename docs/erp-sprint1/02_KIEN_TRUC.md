# ERP V1 — Kiến trúc đề xuất
Trạng thái: bản thiết kế để duyệt; chưa là hệ thống vận hành.

## Nguyên tắc và nguồn chủ quản
Kho quản lý danh mục hàng vật lý, tồn và giao dịch kho; Sale quản lý báo giá, đơn và giá chốt; Care quản lý thiết bị, sửa chữa, bảo hành và tiến độ; Finance quản lý chứng từ, công nợ, thanh toán, chốt sổ. ERP điều phối khóa chung, công việc, sự kiện và báo cáo. Mỗi loại dữ liệu chỉ có một đầu ghi được chỉ định. AI chỉ đề xuất phân loại/ánh xạ/giao việc, người có quyền duyệt mới chốt nghiệp vụ.
Khách hàng: đề xuất danh mục chung do quản trị kinh doanh duyệt, ánh xạ từ ba nguồn; chưa chỉ định Finance hay Sale là danh mục master khi chưa có quyết định vận hành. Nhân viên: danh mục ERP quản trị, ánh xạ tên/ID cũ bằng duyệt thủ công.

## Mô hình dữ liệu chung
Tên bảng/field snake_case, mỗi tab tương ứng một bảng, header hàng 1, không merged cells; UUID lưu text, thời điểm ISO UTC, ngày nghiệp vụ Asia/Ho_Chi_Minh. Tiền VND lưu số nguyên ở contract, PostgreSQL numeric(20,0); lượng numeric(18,3), không dùng float làm kết quả quyết toán. Adapter JS kiểm tra safe integer; số vượt giới hạn từ chối hoặc dùng decimal string có kiểm chứng. VAT lưu decimal string và snapshot theo dòng, không đặt tỷ lệ pháp lý mặc định.

| Bảng | Khóa và liên kết | Trường chính/ràng buộc |
|---|---|---|
| products | id PK, sku UNIQUE | name, kind(stock/service), brand, model, variant, condition, unit_id FK, active, version |
| units / warehouses | id PK, code UNIQUE | name; quy đổi đơn vị chỉ qua bảng conversion được duyệt |
| product_external_keys | (source_system, source_entity, source_key) UNIQUE, product_id FK | approval_status, approved_by, approved_at, source_fingerprint |
| parties / party_external_keys | id PK; khóa ngoài tương tự products | customer/supplier flags, name, tax_code, phone_text; MST trùng tạo cảnh báo, không tự gộp |
| employees / employee_external_keys | id PK, user_key UNIQUE khi có | display_name, active, role; không dùng tên làm khóa |
| quotes / quote_lines | id PK; quote_id, product_id FK | số lượng, giá, VAT, net/tax/gross snapshot; báo giá không tạo doanh thu |
| orders / order_lines | id PK; customer_id, quote_id; order_id/product_id FK | order_no UNIQUE, version, status, snapshot giá/đơn vị/mô tả, fulfillment_status riêng |
| work_orders / work_events | id PK; order_id/order_line_id tùy nghiệp vụ, assignee_id FK | loại công việc, deadline, trạng thái, test_result, completed_at, append-only lịch sử |
| assets / service_tickets | id PK; customer_id, product_id, sale_order_line_id nếu có | model/serial; serial không mặc định duy nhất toàn cầu; ticket_id ngoài hệ thống |
| stock_movements / stock_movement_lines | id PK; source_doc_key UNIQUE; movement_id/product_id/warehouse_id FK | qty signed, order_line_id, reversal_of; transfer có hai vế cùng transfer_id |
| stock_projections | (product_id, warehouse_id) PK | qty, as_of, source_health; chỉ báo cáo, không tạo thêm sổ kho chính |
| revenue_documents / revenue_lines | id PK; order_id/work_order_id, external_finance_key UNIQUE | draft/approved/posted/reversed; người Finance duyệt; doanh thu quản trị tách sổ kế toán |
| payments / payment_allocations | id PK; finance_transaction_id UNIQUE; payment_id/revenue_document_id FK | amount, allocation_amount; nhập projection từ Finance, không tự sửa số tiền |
| integration_events / inbox / outbox | event_id PK; (consumer,event_id) UNIQUE | schema_version, aggregate_id/version, payload_hash, attempts, next_retry_at, state |
| reconciliation_issues / audit_logs | id PK; nguồn + khóa nghiệp vụ | severity, expected/actual hash, resolution; không chứa payload khách hàng đầy đủ |

Các FK bắt buộc trong PostgreSQL; V1 Sheets kiểm tra tại service boundary, báo cáo orphan mỗi lần import. Unique và FK không được giả định chỉ vì đã có header. Export từng bảng CSV + manifest schema_version, checksum, row_count và external_keys; không thay UUID khi chuyển SQL. Migration trên staging: import masters → mappings → orders/lines → work/assets → kho → tài chính projection; kiểm tra FK, tổng lượng theo kho, tổng tiền theo chứng từ, số khóa nguồn trước cutover. Adapter interface giữ nguyên, thay SheetsRepository bằng PostgreSQLRepository sau backend API riêng; không mở PostgreSQL trực tiếp cho trình duyệt.

## Lớp tích hợp
Browser → Auth/RBAC → CommandService/QueryService → Repository interface → Sheets staging.
Legacy read adapters → Mapping/Validation → Projection + reconciliation; không gọi bootstrap/setup của app cũ.
Mỗi adapter khai báo source_id từ Script Properties, sheet_name, header_row, first_data_row, schema_version, required_headers và column mapping. Không nhận sheetId tùy ý từ client. Source registry phân biệt KHO58/KHO145/SALE/CARE/FINANCE và ghi fetched_at. Mất nguồn => health=UNAVAILABLE, tồn/giá=null; không biến lỗi đọc thành tồn 0.

Contract query: {schema_version, request_id, as_of, source_health, data, issues}. Contract command: {request_id, actor_id lấy từ session server, idempotency_key, expected_version, command, payload}; trả {ok, aggregate_id, version, status, issues}. Không tin actor/role do client gửi.
Event envelope: {event_id, schema_version:1, source_system, aggregate_type, aggregate_id, aggregate_version, occurred_at, correlation_id, causation_id, payload_hash, payload}. Cùng event_id/hash: replay no-op; cùng ID khác hash: CONFLICT; bản cũ: ignore có audit; thiếu phiên bản: quarantine và fetch lại nguồn. Không tự phát event dựa trên giao diện hay tên hàng.
Polling read-only theo batch/cursor: lần đầu full snapshot staging, sau đó hash đối chiếu nếu nguồn không có updated_at đáng tin cậy. Không coi sheet row number là cursor bất biến. Source legacy không có outbox: dùng snapshot/checkpoint + reconciliation để phát hiện thay đổi, không giả vờ đã có exactly-once.

## Trạng thái và vận hành
Order: draft → confirmed → in_progress → fulfilled → closed; cancelled chỉ khi chưa phát sinh hoặc đã xử lý hoàn/đảo được duyệt. Work: queued → assigned → doing → testing → completed; blocked có lý do và người xử lý. Hoàn tất kỹ thuật yêu cầu kiểm tra/in thử và kết quả bàn giao; không tự chuyển payment_status=paid.
Revenue: draft → approved → posted; ghi doanh thu quản trị theo chính sách được duyệt và chứng cứ giao/bàn giao, không tự phát hóa đơn thuế. Payment: unpaid/partial/paid dựa trên phân bổ Finance đã xác nhận. Hủy/đổi trả tạo reversal liên kết, không xóa lịch sử.

## Ghi dữ liệu và nhất quán (chỉ triển khai sau Sprint thiết kế)
Apps Script ERP staging độc lập, Sheets staging độc lập. LockService chỉ bảo vệ trong một project; không bảo vệ AI và QL ở hai project. Mọi lệnh kho tương lai phải đi qua cùng chủ quản, không direct-write chéo script. ERP append command journal trước, thực hiện từng bước có operation_id, lưu checkpoint; lỗi giữa chừng chuyển RECOVERY_REQUIRED, retry bằng idempotency, reconciliation xác nhận rồi mới DONE. Sheets không được coi là transaction SQL; không hứa atomic xuyên workbook.
Outbox/inbox staging hỗ trợ retry có backoff, số lần tối đa và dead-letter; schema mismatch, mapping ambiguity, version conflict không tự retry như lỗi mạng. Cache chỉ dành query, không chốt tồn/giá từ cache; command cần fresh-read và expected_version. Báo cáo doanh thu/thu tiền tách riêng, luôn hiển thị as_of và phạm vi nguồn.

## Phương án triển khai
1. Chốt các quyết định master, doanh thu và số đơn; giữ app cũ vận hành.
2. Tạo GAS/Sheets staging mới sau phê duyệt; cấu hình IDs qua Script Properties; service read-only độc lập. Chỉ cấp đúng quyền staging, không thay quyền production.
3. Nạp fixture trước, sau đó mẫu dữ liệu ẩn thông tin cá nhân được duyệt; so sánh schema/mapping. Không chạy bộ CustomerData nhập cũ hoặc migration legacy.
4. Shadow-read legacy nếu được cấp quyền; đối chiếu, không phát lệnh ghi. Dry-run trả kế hoạch tác động.
5. Pilot một luồng nhận đơn → giao việc → test → bàn giao → đề nghị ghi doanh thu; Finance vẫn duyệt thủ công. Chưa bật đồng bộ ghi kho/Finance nếu chưa đạt các ca recovery.
6. Chỉ cutover sau nghiệm thu và phê duyệt production riêng. Chốt nguồn ghi, backup được xác nhận, cửa sổ chuyển, reconciliation cuối kỳ; không ghi hai đầu.
Rollback: tắt worker/commands ERP, về app cũ theo kế hoạch; giữ journal/checkpoint; đối chiếu mọi operation đã ghi, tạo reversal qua chủ quản khi được duyệt. Không rollback bằng xóa chứng từ.

## An toàn triển khai
Không thêm code runtime Sprint 1 vì chưa xác nhận schema live và chính sách vận hành. PR chỉ tài liệu dưới docs/erp-sprint1 trong SALE, branch riêng; không kích hoạt trigger main hiện có. Staging CI tương lai: syntax/unit/contract fixtures, không có credential production; job deploy staging thủ công vào đúng script_id. Production gate riêng, pin clasp version và deployment_id rõ ràng, không chọn deployment theo version cao nhất. Không sửa access, secret hay workflow production trong Sprint này.
