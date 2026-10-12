# ERP Sprint 1 — prototype tích hợp và luồng đơn/công việc
Trạng thái: mã thử nghiệm local, chưa phải ERP đã triển khai. Có lưu trữ local bằng file dành cho fixture; có adapter Sheets staging đã test giả lập; chưa có UI, file Google Sheets staging thực tế, endpoint web, trigger, thanh toán hoặc lệnh ghi kho/tài chính.

## Đã có
- Adapter đọc 10 bảng từ 5 nguồn, dựa trên headers thực tế đọc ngày 12/10/2026.
- Chỉ đọc cột cần thiết; không đọc dữ liệu mật khẩu/salt/phiên đăng nhập nhân viên.
- Kiểm tra required/duplicate headers, phân trang tối đa 100 dòng; nguồn lỗi không biến tồn thành 0.
- Ánh xạ product theo namespace và khóa ngoài đã duyệt; không ghép theo tên.
- Pure domain tạo đơn → xác nhận → giao kỹ thuật → thực hiện → test → bàn giao → đề nghị doanh thu → Finance duyệt. Payment giữ unpaid.
- Idempotency theo actor+key, version conflict, kiểm quyền vai trò, khóa ngoại, safe integer và snapshot tên/đơn vị/giá.
- Số đơn TD-YYYYMMDD-0001 theo ngày Việt Nam, không tái sử dụng số đã cấp; journal PREPARED/COMMITTED, single-writer lock và hash kiểm tra phục hồi trên local fixture.
- Hủy trước khi xuất giữ đơn/lịch sử; sau khi xuất đề nghị hoàn/đảo và duyệt bằng người khác. Chỉ ghi trạng thái đề nghị/duyệt fixture, không thực hiện hoàn kho hoặc đảo Finance.

## Chạy kiểm thử
`node --test erp-prototype/test/*.test.cjs`

## Build GAS riêng (không deploy)
`python3 erp-prototype/build-staging.py /tmp/thanhduc-erp-staging`

Build ra Code.gs riêng, không appsscript manifest hoặc clasp credentials. Không copy vào 5 project legacy. .cjs và .gs.txt giữ prototype ngoài runtime mặc định; chưa thay workflow/clasp config. Build tạo namespace IIFE, không require/module.exports ở output.
`erpRunFixtureDemo()` chỉ tính trên bộ nhớ. `erpReadStagingSource()` mặc định tắt; chỉ bật trong project staging riêng đã xác minh, registry lấy từ Script Properties ERP_SOURCE_KHO58/KHO145/SALE/CARE/FINANCE. Không có endpoint web nên chưa có flow đăng nhập. actor của domain phải do auth server cung cấp khi triển khai; module không tự xác thực người dùng.

## Giới hạn
- Domain vẫn pure; LocalRepository lưu state/journal riêng ngoài mã nguồn và khóa ghi giữa các process. Module local dùng node:fs, KHÔNG được đóng gói GAS. Đã bổ sung SheetsRepository và guard project/file; cần kiểm thử Apps Script staging thực tế trước pilot.
- Hard exit giữ writer.lock; chỉ operator kiểm tra tiến trình cũ đã dừng rồi mới phục hồi. Không tự phá khóa; lỗi hash/state chuyển RECOVERY_CONFLICT và không ghi đè. Đây là kiểm thử file trên Linux, không chứng minh atomic/recovery của Google Sheets.
- Prototype hiện giới hạn số lượng nguyên và giá gross VND nguyên; chưa xử lý VAT decomposition, số lượng thập phân, giá âm, hoàn một phần/đổi sản phẩm thực tế, chia đơn, nhiều work order và công nợ. Không dùng để quyết toán.
- Adapter trả raw dates để lớp normalization xử lý sau; số điện thoại là text, không tự thêm số 0. Qty string theo định dạng locale phải chuẩn hóa ở bước riêng; không tự đoán dấu phẩy/chấm.
- Kho 145 thiếu mã chuẩn trả UNMAPPED_PRODUCT; không cấp source_key theo số dòng. Không dùng projection để ghi kho.
- Chỉ đọc metadata và hàng tiêu đề thực tế; không đọc business rows, chưa chứng minh workbook Sale đang gắn với deployment hoặc Care property override hiện hành.
- Finance live hiện không có tab NHA_CUNG_CAP trong metadata, dù code có cấu hình tên đó. Adapter chưa hỗ trợ bảng này; chưa kết luận nghiệp vụ nhà cung cấp bị lỗi.
- Sale workbook timezone America/Los_Angeles khác APP.TZ Asia/Ho_Chi_Minh; không đổi setting tự động. Cần xử lý ngày tại adapter trước pilot.

## Nghiệm thu còn lại
Auth/session thật, triển khai/kiểm thử storage Sheets staging thực tế, VAT/date normalization, UI, dữ liệu mapping đã duyệt, kiểm thử Apps Script và xác nhận nguồn runtime. Chưa tạo Sheets/GAS staging, chưa merge/deploy, không đổi dữ liệu hoặc quyền production.

## Adapter Sheets staging
Xem SHEETS_STAGING.md cho schema, checkpoint, guard và giới hạn. Adapter đã nằm trong build GAS; không tự tạo tab hoặc cấu hình. Chỉ các test fake workbook đã thực hiện writes, chưa ghi Google Sheets thực tế.
