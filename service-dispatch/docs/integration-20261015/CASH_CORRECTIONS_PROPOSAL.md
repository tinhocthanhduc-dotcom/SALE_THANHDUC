# Điều chỉnh tiền mặt — quyết định chủ ngày 15/10/2026, triển khai trên bản sao

Thay thế đề xuất phiếu âm trước đây: **hủy THU gốc bằng `deleteTransaction` (DA_HUY, giữ audit), rồi tạo THU đúng số**. Chưa triển khai Finance thật.

- Thợ đang được giao và là người báo PT, hoặc kế toán, lập `request_cash_correction`: số đúng nguyên VND ≥0 khác số cũ, lý do bắt buộc, ảnh có thể chọn từ ảnh đã lưu trên đơn. Mỗi PT một ĐC mở. Giám đốc khác người đề nghị duyệt/từ chối. ĐC chưa duyệt giữ nguyên toàn bộ tiền; người khác không xem tiền thợ.
- PT phải là tiền mặt, chưa có NQ nào còn hiệu lực. NQ chờ được người lập/kế toán/giám đốc hủy bằng `cancel_deposit`, lý do và lịch sử giữ nguyên. NQ đã xác nhận, kể cả thiếu/0 thực nhận, chặn điều chỉnh trong bản đầu: cần giám đốc xử lý ngoài app. Không đảo NQ.
- Duyệt kiểm lại phiên bản PT, khoản nộp và khả năng thu tăng; tạm chặn thu thêm/nộp quỹ/đóng hồ sơ trong lúc Finance xử lý để không đua số tiền. ĐC chờ duyệt cũng chặn đóng hồ sơ nhưng không thay số dư.
- External keys: `DIEUPHOI:DC:<DC-no>:HUY`, `DIEUPHOI:DC:<DC-no>:THU`. Một PT có phân bổ hàng/công thì native chứng từ con thêm `:goods` / `:service`, như consumer trước đây. Giữ key nhóm đúng theo quyết định chủ; không dùng số âm. HUY phải ack trước khi THU được xuất sang Finance. Với 0đ chỉ HUY.
- Nếu gốc chưa ghi Finance: xuất tombstone đã ký thay envelope gốc, không phát THU gốc; bước HUY ghi chặn bền vững trên Finance và xác minh chưa có chứng từ thực tế. Nếu có yêu cầu gốc đã đọc envelope cũ đang chạy, hoặc Finance đã ghi nhưng Điều phối mất ack: native lock và chặn bền vững đảm bảo gốc được hủy và không thể ghi lại sau HUY.
- Bản sao Finance lưu fence trong `DISPATCH_FINANCE_CORRECTIONS`, gồm external key, nguồn, trạng thái, fingerprint và kết quả. Khóa native dùng chung với saveTransaction. Chỉ consumer riêng tư mới được dùng external key Điều phối; không cho giả qua API ghi phiếu công khai.
- Tài khoản và danh mục lấy từ mapping snapshot PT gốc; không lấy gán mới. Số đúng chia theo tỷ trọng hàng/công trên các dòng THU gốc (làm tròn VND, tổng chính xác); không đổi doanh thu nghiệm thu. Native so khớp loại/account/category/amount trước hủy, không hủy nhầm chứng từ đã được sửa thủ công.
- Sau ack thành công đầy đủ: PT gốc `replaced` (UI Đã thay thế), nguyên số tiền/người/ảnh giữ nguyên; PT mới liên kết gốc và ĐC, giữ người thợ cũ, ngày lập mới là ngày duyệt. 0đ không tạo PT/THU mới. NQ sau đó tham chiếu key Finance của PT thay thế.
- Trong lúc Finance đang ghi dở, sổ Điều phối chưa áp dụng delta; hiển thị trạng thái chờ/lỗi và khóa NQ/đóng hồ sơ. Retry từng bước, replay không lặp THU/hủy/ĐC. Không dùng duyệt ngoại lệ đồng bộ để bỏ qua ĐC đang xử lý.
- Ngày gốc đã chốt theo guard Finance dùng chung: báo FINANCE_DATE_CLOSED, Admin phải mở khóa trước. Không tự đổi ngày gốc để né chốt.

## Các số đối chiếu

Ví dụ doanh thu đã nghiệm thu 200k, tiền mặt báo 100k sửa còn 80k:

| Chỉ tiêu | Trước / chưa duyệt / đang chờ Finance | Sau đủ ack | Sau kế toán nhận NQ 80k |
|---|---:|---:|---:|
| Finance: Tiền nhân viên đang giữ | 100k trước HUY | 80k | 0 |
| Điều phối: thợ giữ | 100k | 80k | 0 |
| Đã báo thu | 100k | 80k | 80k |
| Còn **được báo thu** (`collectable`) | 100k | 120k | 120k |
| Còn chưa xác nhận (`remaining`, quy tắc cũ) | 200k | 200k | 120k |
| Doanh thu nghiệm thu | 200k | 200k | 200k |

Finance có thể tạm 0 / 40k trong lúc HUY xong / THU ghi được một phần; Điều phối vẫn 100k và khóa NQ đến ack đủ. Đây là trạng thái đối soát đang xử lý, không được đóng hồ sơ. Cách tính `remaining`/`collectable` của app cũ được giữ nguyên: báo tiền mặt chưa đồng nghĩa kế toán đã nhận quỹ.

## Kiểm chứng và vận hành

- Domain, native Finance, HTTP/browser và signed outbox: xem `CASH_CORRECTIONS_REVIEW.md` và kết quả kiểm thử kèm diff.
- `runFinanceCopyCorrectionUat` chỉ owner, tạo **một workbook Google mới với dữ liệu mẫu**, không ghi workbook Finance copy đã cấu hình hoặc Finance thật. Kết quả trả workbook ID, danh sách ngày chốt cũ (đọc), các ca pass/fail và số dư mẫu. Google Execution API được thử tự động; nếu không trả kết quả, cần owner chạy đúng hàm trên editor bản sao. Không gọi kết quả mô phỏng là Google UAT.
