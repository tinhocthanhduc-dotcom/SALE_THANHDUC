# Điều chỉnh tiền mặt báo nhầm — đề xuất trước pilot

Trạng thái: **chưa triển khai**, cần chủ chốt nghiệp vụ và duyệt riêng trước pilot. Bản nối hiện ghi THU vào tài khoản Tiền nhân viên đang giữ ngay khi thợ báo tiền mặt; đây là tiền báo thu, chưa phải tiền đã về Quỹ tiền mặt. NQ chỉ chuyển số thực nhận giữa hai tài khoản, không tạo doanh thu mới.

## Hiện tại khi phát hiện sai

- Giữ PT gốc, lịch sử và chứng từ Finance; không sửa/xóa dòng đã ghi, không nhập trực tiếp số âm vào Sheets.
- Không dùng NQ thiếu tiền để sửa PT báo nhầm: thiếu do thợ chưa nộp vẫn là tiền thợ giữ; không đồng nghĩa khách chưa trả. Không tạo phiếu CHI giả hoặc tự thay đổi giá đơn để bù.
- Dừng thử đơn đó và báo quản trị đối chiếu. Hiện chưa có nút điều chỉnh được duyệt; đơn chưa đối soát xong không đưa vào vận hành thật.
- Không retry chứng từ đang có nghi vấn để đổi số tiền. Retry phải giữ nguyên nội dung và external key của chứng từ gốc.

## Luồng đề nghị

1. Thợ hoặc kế toán lập đề nghị ĐC liên kết PT, đơn TD, tài khoản Finance đã chốt trên PT, số đúng, chênh lệch và lý do; có ảnh/đối chiếu khi cần. Chỉ được một đề nghị mở trên mỗi PT.
2. Kế toán đối chiếu; giám đốc khác người đề nghị duyệt. Cấm tự duyệt, kiểm phiên bản PT/đề nghị; đề nghị chưa duyệt không thay số dư hoặc số còn phải thu.
3. Khi duyệt, tạo chứng từ bù bất biến và outbox trong cùng command, không sửa PT. Phải bổ sung nghiệp vụ điều chỉnh native Finance cho khoản giảm (phiếu âm/reversal có liên kết nguồn và kiểm quyền); không giả định THU hiện tại chấp nhận số âm. Tài khoản/danh mục phân bổ theo snapshot PT gốc, không theo cấu hình vừa đổi.
4. External key riêng `DIEUPHOI:DC:<so-DC>` cùng liên kết nguồn PT; Finance kiểm durable dedupe trong lock. Lỗi mạng/replay không ghi hai lần, kết quả ký như chứng từ khác. Không hủy/xóa outbox gốc đã gửi: trước hết xác minh PT gốc đã ghi hoặc chưa ghi, tránh đua giữa ghi gốc và điều chỉnh.
5. Sau khi Finance trả kết quả ghi thành công mới áp dụng delta vào sổ Điều phối, số còn phải thu, tiền thợ giữ và báo cáo; giữ audit trước/sau và liên kết hai chứng từ. Trong khi chờ thì chặn NQ/đóng hồ sơ của khoản liên quan. Nếu đổi bản ghi trong lúc chờ, bắt đối soát lại trước khi duyệt.
6. PT chưa nộp quỹ: ví dụ báo 100k nhưng khách thực trả 80k → điều chỉnh -20k; tiền thợ giữ giảm 20k, số còn phải thu tăng 20k, doanh thu nghiệm thu không đổi. Nếu thực thu 120k, phải kiểm số còn phải thu trước khi cho tăng, không thu vượt tổng.
7. PT đã có NQ chờ hoặc đã nộp: không giảm tiền giữ xuống âm. Phải hủy đề nghị NQ chưa xác nhận bằng nghiệp vụ có lịch sử hoặc đối soát/đảo phần NQ liên quan có duyệt trước; thừa tiền đã nhận cần luồng hoàn/điều chỉnh riêng, không tự trừ quỹ. Ngày gốc đã chốt thì ghi điều chỉnh ngày đang mở, liên kết ngày gốc; không mở lại/ngầm đổi ngày.

Kiểm thử bắt buộc khi làm: giảm/tăng báo nhầm, thu vượt, tự duyệt, phiên bản cũ, hai đề nghị trùng, NQ chờ/đã nhận một phần/đủ, ngày đóng, Finance ghi nửa chừng, replay và lỗi sau ghi nhưng trước ack; đối chiếu cả số dư Finance, tiền giữ, phải thu và báo cáo. Đây là hạng mục riêng, không được coi UAT nối cơ bản là đã kiểm xong điều chỉnh.
