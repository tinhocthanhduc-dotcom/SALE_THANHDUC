# Bật lại chốt sổ có mở khóa — bản review riêng, chưa deploy Finance thật

Quyết định chủ 15/10/2026 thay thế chính sách v0.23: bật lại khóa ngày theo LOCK_AFTER_CLOSE; chỉ Admin mở khóa và phải có lý do. Diff dựa trên Finance `d3c460700bb8823272374e16aea5d762c2cf10f5`, nhánh local `review/close-day-unlock-20261015`. Không push main, không deploy project Finance thật.

## Cơ chế

- Màn Chốt sổ / mở khóa hiện cho ADMIN/KE_TOAN. API `listFinanceClosings`, `enableFinanceClosingGuard`, `unlockFinanceDay` dùng phiên native qua `apiCall`; không thêm cách đăng nhập hay tự cấp vai trò.
- Admin bật một lần bằng `enableFinanceClosingGuard`. Thêm cột cuối CHOT_SO `AP_DUNG_KHOA`, giữ nguyên dữ liệu/cột cũ. Property activation tách theo workbook: `FINANCE_CLOSE_GUARD_ENABLED_AT:<spreadsheet-id>`. Lần bật lại không đổi dấu thời gian hoặc đánh dấu hàng cũ.
- `closeDay` vẫn đếm quỹ và ghi chênh lệch; mỗi lần chốt mới có `AP_DUNG_KHOA=true`. Các hàng trước v0.23 hoặc chưa được đánh dấu không tự khóa lại, kể cả ngày 28/9 đang nhập bù. Chủ có thể chủ động chốt lại một ngày cũ khi đã kiểm xong, tạo hàng mới có khóa.
- `isDateClosed_` là **guard duy nhất** cho native và consumer: ngày Việt Nam, LOCK_AFTER_CLOSE, AP_DUNG_KHOA=true, TRANG_THAI=DA_CHOT và không MO_KHOA_BOI/MO_KHOA_LUC. Không còn guard đọc CHOT_SO riêng trong consumer.
- Guard đọc trực tiếp bảng, không dùng request-cache cũ. Thiếu sheet, cấu trúc/cấu hình không hợp lệ, mất cột đánh dấu sau activation hoặc lỗi đọc đều throw; không coi là ngày mở.
- Chỉ ADMIN gọi `unlockFinanceDay`, ID chốt và lý do bắt buộc, ghi DA_MO_LAI/MO_KHOA_BOI/MO_KHOA_LUC, lý do và audit. Chốt lại thêm dòng mới, không ghi đè lịch sử.

## Đường ghi đã rà

| Đường ghi | Kiểm khóa |
|---|---|
| saveTransaction THU/CHI | Kiểm lại trong ScriptLock, kể cả ngày vừa bị chốt trong lúc chờ |
| updateTransaction | Ngày gốc và ngày mới trong lock |
| deleteTransaction | Ngày gốc trong lock; hủy DA_HUY có audit, không xóa hàng |
| saveInternalTransfer tạo/sửa | Ngày cũ và mới trong lock |
| deleteInternalTransfer | Ngày gốc trong lock |
| saveDebt KH/NCC | Ngày hóa đơn trong lock |
| updateDebt KH/NCC | Ngày hóa đơn cũ và mới trong lock |
| deleteDebt KH/NCC | Ngày gốc trong lock |
| Consumer THU / CHUYEN_QUY / CONG_NO_KH | Đi qua các hàm trên; ĐC HUY còn kiểm ngày PT gốc trước fence và từng hủy |
| Import/batch thu/chi/hóa đơn | Source hiện tại không có writer import sổ độc lập; mọi consumer/batch gọi native writers từng phiếu và chịu cùng guard |
| Sửa số dư đầu kỳ / resetOperationalData | Chặn khi còn bất kỳ ngày được khóa mới; cần mở khóa có audit trước |

Tính lại số dư/tổng hợp không sửa chứng từ nguồn, vẫn được chạy. Thu hôm nay để thanh toán hóa đơn cũ vẫn là một chứng từ ngày hôm nay; cập nhật số công nợ còn lại qua allocation native không đổi ngày/tổng hóa đơn cũ. Import danh bạ/chuẩn hóa tên/điện thoại không phải đường ghi tiền; migration đổi tham chiếu sổ cần hoàn tất trước activation, không dùng để sửa tiền hoặc né ngày khóa.

## Kiểm thử và khôi phục

- Native copy tests: khóa/ngày mở, ngày gốc và mới, THU/CHI/chuyển quỹ/công nợ, quyền, mở khóa/chốt lại, đọc lỗi/schema mất, LOCK_AFTER_CLOSE=false, mốc 23:59:59→00:00 theo Việt Nam, chốt chen vào lúc writer đang chờ lock, native apiCall có phiên.
- Consumer UAT chạy trên **workbook Google mới chỉ chứa dữ liệu mẫu**; danh sách CHOT_SO của copy hiện tại được đọc và ghi vào báo cáo. Chưa có báo cáo Google pass thì chưa coi đã UAT thực tế.
- Diff và kế hoạch khôi phục: `CASH_CORRECTIONS_REVIEW.md`. Cần chủ duyệt riêng triển khai Finance thật sau khi đối chiếu bản sao. Không push main trong đợt này.
