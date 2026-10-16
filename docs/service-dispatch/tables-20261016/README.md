# Lưu theo bảng: thiết kế và kiểm chứng local

DP_ORDERS/CUSTOMERS/MACHINES/PAYMENTS/DEPOSITS/DEBTS/CASH_CORRECTIONS/OUTBOX/SEQUENCES lưu từng bản ghi. DP_META lưu schema/revision, intent giao dịch và các lá cấu hình. DP_EVENTS và DP_COMMANDS append-only; receipt tra đúng khóa actor + idempotency key, không nạp lịch sử command toàn bộ. Mỗi dòng có metadata tìm bằng TextFinder literal và tối đa bốn ô JSON 40.000 ký tự; trần 160.000 ký tự **một bản ghi**, không có trần 1MB cho toàn state.

Command nạp đơn/quan hệ liên quan và cấu hình, chạy nguyên Domain rồi diff chỉ các dòng thay đổi. Journal chia delta thành chunk có hash, ghi durable PREPARED dưới ScriptLock; recovery kiểm toàn bộ before/after hash trước khi roll-forward, commit revision rồi xóa intent. Lỗi giữa các bước retry không tạo command/event trùng. Cache driver chỉ sống trong một lock; xóa khi lấy lock mới để không dùng dữ liệu cũ sau một writer khác. Legacy repository và các fault test cũ được giữ nguyên.

Danh sách ban đầu chỉ nạp đơn chưa đóng hồ sơ; công việc đã nghiệm thu nhưng chưa đóng vẫn nằm trong state để theo dõi tài chính. Tài chính đang chờ được nạp độc lập, quyền projection giữ nguyên. Đã đóng tải riêng 30 ngày gần nhất; báo cáo tải riêng dữ liệu ngày chọn, hoặc tất cả khi không chọn ngày. Báo cáo toàn lịch sử có thể chậm và chưa có phân trang. Đơn đóng lâu được chuyển delta sang archive, có tombstone để giữ vị trí dòng; cập nhật đơn archive vẫn nằm ở archive, mở lại thì chuyển về active trong cùng giao dịch.

## Mô phỏng dung lượng

| Bảng | 9.000 đơn | 10.950 đơn (30 × 365) |
|---|---:|---:|
| DP_ORDERS (kể cả tombstone) | 9.000 | 10.950 |
| DP_CUSTOMERS | 900 | 1.095 |
| DP_PAYMENTS | 9.000 | 10.950 |
| DP_DEPOSITS | 9.000 | 10.950 |
| DP_SEQUENCES | 1.200 | 1.460 |
| DP_COMMANDS | 99.900 | 121.545 |
| DP_EVENTS | 117.900 | 143.445 |
| DP_JOURNAL (manifest + chunk) | 200.876 | 244.426 |
| DP_ARCHIVE_ORDERS | 8.070 | 10.020 |
| DP_META | 1 | 1 |
| MACHINES / DEBTS / CASH_CORRECTIONS / OUTBOX | 0 | 0 |
| Ô dữ liệu đã dùng, 15 cột/bảng | 6.837.915 | 8.322.840 |

Mỗi đơn chạy Domain thật: tạo, giao, nhận, bắt đầu, hai ảnh metadata, nghiệm thu 100k công, tiền mặt, NQ, xác nhận, đóng; cứ 30 đơn archive một lần. 9.000 đơn chạy local khoảng 23s; đây là CPU/bộ nhớ, **không phải tốc độ Sheets**. JSON kèm số dòng và ước tính ô lưới tối thiểu 1.000 dòng/tab. Giới hạn Google tính ô được cấp phát của **toàn tệp**, còn gồm tab legacy/backup đã sao chép, chưa nằm trong cột “ô dữ liệu”. Driver kiểm dung lượng thật trước khi mở rộng.

Đây là mô hình cơ sở không có hàng giao/công nợ/điều chỉnh/outbox. Các luồng đó có kiểm thử nghiệp vụ riêng; chưa chứng minh cùng 9.000 đơn phức tạp đều nằm dưới 10 triệu ô. Journal/command/event tiếp tục tăng; cần chính sách lưu trữ dài hạn, giám sát ngưỡng 70% và đo workload thực. Không gọi đây là dung lượng vô hạn.

## Native và rollout

**Chưa đo Google với 1.000 đơn; chưa xác nhận <5s / <3s.** Chưa deploy hoặc migrate staging trong đợt này. [Hướng dẫn bản sao, đo và rollback](OWNER_SETUP.md). Mốc trước pilot còn: benchmark native, UAT toàn bộ trên COPY, workload hỗn hợp, rollback sau ghi mới và phân trang báo cáo toàn lịch sử.
