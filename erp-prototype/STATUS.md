# Thành Đức ERP — bảng tiến độ hiện hành
Cập nhật: 12/10/2026. Mốc hiện tại: bản thử nghiệm OFFLINE có giao diện đã hoàn thiện để dùng dữ liệu giả. Chưa phải ERP vận hành thật.

| Hạng mục | Đã có | Chưa có / giới hạn |
|---|---|---|
| Kiểm toán và nguồn dữ liệu | 5 repo, metadata 5 Sheets, 16 headers | chưa đọc business rows hoặc xác nhận binding deployment Sale/Care |
| Nguyên tắc | Kho 58 master; ERP khách/nhân viên; Finance duyệt; số đơn theo ngày; hủy/hoàn giữ lịch sử | người duyệt vận hành cụ thể chưa xác nhận |
| Domain đơn–công việc | tạo/xác nhận/giao/test/bàn giao/doanh thu, version, idempotency | partial fulfillment, nhiều task và VAT chưa triển khai |
| Lưu trữ kỹ thuật | file local có journal; SheetsRepository có chunks/checksum/guard | Sheets repository mới test giả lập, chưa tạo staging thật |
| Giao diện | tổng quan, đơn, việc, doanh thu, nhật ký, tiến độ, tìm kiếm, đa dòng, mobile | chọn vai trò demo, không phải auth server |
| Dữ liệu giao diện | fixture localStorage, đồng bộ revision, export/reset có xác nhận | không kết nối Sheets, không có dữ liệu thật |
| Kiểm thử | 58 core + 15 scenario trình duyệt local đạt; CI kiểm trên PR | chưa UAT Apps Script thực tế, quota/concurrency Google |
| Triển khai | mã và docs trên branch riêng/PR #1 | chưa merge, deploy hoặc đổi quyền |

## Mốc bàn giao đã đạt trong lượt này
- HTML self-contained mở offline, có 4 đơn mẫu ở các trạng thái khác nhau.
- Luồng tạo đơn → giao kỹ thuật → in thử → bàn giao → đề nghị và duyệt doanh thu, tiền thu riêng.
- Dùng chung domain hiện hành; browser tests thực hiện qua DOM và đối chiếu kết quả.
- Cập nhật PR, hướng dẫn thao tác, kết quả test; không tác động hệ thống thực tế.

## Mốc tiếp theo: staging thật
1. Xác định/tạo project GAS và Sheets staging mới, xác minh khác project/file legacy; không ghi production.
2. Xây auth/session server, masters, API command/query và nối UI với repository staging; actor/role lấy từ server.
3. Kiểm thử Google thực tế với fixture: recovery, concurrency, durability, quota và rollback.
4. Xác minh nguồn runtime, mapping, người duyệt hoàn/đảo; UAT trước pilot.

## Những việc cần người dùng quyết định trước pilot
Review PR; xác nhận project/file staging và người có quyền duyệt. Không yêu cầu chốt lại 5 nguyên tắc đã duyệt. Chưa có phê duyệt merge/deploy production.

## Rủi ro còn lại
Snapshot tổng state tăng nhanh, chỉ phù hợp pilot kỹ thuật nhỏ; cần normalized tables và benchmark. Bản HTML client-side không có auth bảo mật; dữ liệu localStorage có thể bị sửa/mất. Không dùng dữ liệu hoặc giao dịch thật trong demo.
