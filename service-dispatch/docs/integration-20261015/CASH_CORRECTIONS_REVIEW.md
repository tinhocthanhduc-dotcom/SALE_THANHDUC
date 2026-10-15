# Bàn giao review — ĐC tiền mặt và chốt sổ Finance

## Phạm vi

Điều phối staging và các consumer bản sao hiện có; Finance chỉ nhánh review/diff, không main và không project thật. Kho/AI_KHO thật giữ nguyên. Giữ nguyên tài khoản, Sheets/Drive và mọi dữ liệu hiện có của staging. Không backfill, reset hoặc sửa PT/NQ cũ hàng loạt.

## Chạy thử

1. Giữ copy token/HMAC, bảng gán đã có. Cập nhật Code của consumer Finance **bản sao** bằng pipeline copy (không bootstrap lại, không xoay token hay tự cài trigger).
2. Xem danh sách ngày cũ trong báo cáo `FINANCE_COPY_CORRECTIONS_UAT_20261015` hoặc chạy `listFinanceClosings` ở copy. Admin chạy `enableFinanceClosingGuard` nếu chưa active; thao tác này không khóa hàng cũ.
3. Thợ: Tiền tôi đang giữ → Kiểm tra / đề nghị sửa phiếu tiền mặt → số đúng + lý do; có thể chọn ảnh đã lưu trên đơn. Có NQ chờ thì Hủy phiếu nộp + lý do trước. Hoặc kế toán đề nghị tại Quỹ.
4. Giám đốc: Quỹ → ĐC → Duyệt/Từ chối. Người đề nghị không tự duyệt.
5. Đồng bộ → Nhận kết quả từ Kho / Finance; copy consumer nhận HUY trước, THU sau khi HUY ack. Có thể cần chạy nhận/pump lần tiếp theo cho bước THU. Đang chờ Finance thì không nộp NQ/thu thêm/đóng đơn.
6. Kiểm PT gốc Đã thay thế, PT mới/DC có liên kết, số tiền giữ/còn được báo thu, Finance THU gốc DA_HUY và THU mới đúng snapshot. Hàng/công/doanh thu nghiệm thu không đổi.
7. Chốt ngày mới; thử sửa/hủy/thu vào ngày đó bị chặn. Admin mở khóa có lý do, làm lại ĐC/ghi phiếu, rồi chốt lại tạo dòng mới.

`runFinanceCopyCorrectionUat` là hàm owner-only trên **project Finance COPY**. Hàm tạo workbook Google mới, dữ liệu mẫu, hủy/ghi lại và lỗi nửa chừng/replay/chốt/mở lại; không ghi Finance copy đang cấu hình hay Finance thật. API probe thử chạy riêng tư. Nếu Execution API không hỗ trợ, owner chạy hàm trong dropdown Run và lấy JSON kết quả; không gửi credential/token vào chat.

Finance review commit local: `4b9abfc` trên nhánh `review/close-day-unlock-20261015` (base `d3c4607`); không push Finance. [Diff chỉ hai file code/UI](FINANCE_CLOSE_DAY_REVIEW.patch).

## Kiểm chứng

- `npm test --prefix service-dispatch`: domain/auth/repository/bridge và ĐC.
- `node --test service-dispatch/integration/test-cash-finance.cjs`: native Finance writers trên workbook mô phỏng (private native source, không cần Google).
- `node service-dispatch/integration/test-native.cjs <scratch>`: 98 ca native Kho + consumer Finance cũ.
- `ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/cash-corrections-browser.cjs`: UI thợ/giám đốc/kế toán, lỗi Finance, hủy NQ và quyền thợ khác; chạy thêm các bộ hồi quy trong CI.
- Kết quả Google và danh sách ngày chốt: báo cáo artifact UAT riêng. Không gộp pass mô phỏng với Google pass.

## Kết quả Google 15/10/2026

Dispatch staging v51 (`dc80d4a`), copy consumers và audit được cập nhật thành công. [Probe thực tế](GOOGLE_COPY_UAT_RESULT.json): quyền Google hiện có cho phép đẩy Apps Script nhưng Sheets API và Execution API đều trả **403 PERMISSION_DENIED**. Chưa có pass UAT hay danh sách ngày CHOT_SO từ Google; không suy ra từ kiểm thử native.

Chủ mở [Finance COPY editor](https://script.google.com/d/1FuBiv-e2UbP-FjLaNoh56XX8BEllZWIX7lbiee_dejmqAVFgzF8uAuqf/edit), chọn `runFinanceCopyCorrectionUat` → **Chạy**. Nếu Google yêu cầu, cấp quyền cho chính project bản sao. Nhật ký trả JSON gồm `existing_closing_dates`, workbook UAT mới và từng kết quả; không chứa mật khẩu/token. Hàm chỉ đọc workbook copy đang cấu hình và ghi vào workbook mẫu mới. Có thể dùng ID workbook báo cáo để đối chiếu trực tiếp giao dịch/số dư. Chưa bật khóa trên workbook copy vận hành cho tới khi chủ xem danh sách ngày cũ.

## Khôi phục

**Trước khi UAT dữ liệu của bản sao đang dùng:** sao lưu đồng bộ workbook Finance COPY, workbook trạng thái Điều phối và OUTBOX; lưu ID/phiên bản project hiện hành. Workbook UAT mới được giữ riêng theo ID trong báo cáo, không cần khôi phục dữ liệu copy gốc sau test tự động.

**Nếu mới cập nhật code, chưa có ĐC áp dụng/chốt mới:** tắt `DISPATCH_BRIDGE_ENABLED` trên consumer copy, dừng nhận/pump trong lúc khôi phục; khôi phục bản code staging/consumer trước đợt này và kiểm lại outbox. Không xóa rows hay xoay HMAC. Với Finance thật đợt này chưa deploy nên không có thao tác rollback thật.

**Nếu đã có ĐC áp dụng hoặc chốt/mở khóa mới:** không đưa app v50 cũ lên dữ liệu mới một cách đơn lẻ (v50 chưa hiểu replaced/cancelled/fence). Giữ bản đọc sổ mới, tạm dừng nhận chứng từ, đối chiếu PT/DC/THU/NQ và sửa tiếp. Chỉ khôi phục toàn bộ các snapshot đồng thời trên bản sao cô lập sau khi đối chiếu; không phục hồi riêng một sheet/phiếu, không xóa fence, không làm sống lại THU gốc. Không dùng resetOperationalData hay số dư đầu kỳ để bù sai.

Không xóa cột AP_DUNG_KHOA hoặc property activation sau khi có ngày chốt mới để né khóa. Nếu cần mở ngày thì dùng đúng unlockFinanceDay và lý do/audit, chốt lại sau đó. Triển khai hoặc khôi phục Finance thật cần chủ duyệt riêng; tuyệt đối không push main tự deploy trong đợt review.
