# Finance thật: khôi phục khóa ngày chốt — yêu cầu duyệt riêng

**Chưa sửa hoặc deploy Finance thật.** Đây là thay đổi nghiệp vụ Finance, tách khỏi phần nối Điều phối. Chủ cần duyệt riêng sau khi kiểm trên bản sao và rà soát ý định loại bỏ chốt sổ ở phiên bản Finance đang chạy.

## Hiện trạng

Source Finance checkout d3c4607: `code.js:7482`, hàm `isDateClosed_` luôn trả false (ghi chú v0.23 đã bỏ chức năng chốt sổ). Vì vậy các đường ghi có gọi hàm này vẫn có thể ghi vào ngày từng chốt; không được mô tả Finance thật đã khóa ngày. Consumer Finance bản sao có guard riêng đọc CHOT_SO; guard này không thay app Finance thật và không bảo vệ người dùng ghi qua app thật.

## Phạm vi bản vá đề nghị

- Chốt chính sách có tiếp tục khóa ngày sau chốt hay không và xử lý cấu hình LOCK_AFTER_CLOSE; không tự bật lại chính sách của phiên bản cũ.
- Nếu chủ chọn khóa: kiểm CHOT_SO theo ngày nghiệp vụ và timezone Việt Nam. Dữ liệu chốt bị lỗi/không đọc được phải báo lỗi, không mặc định ngày mở.
- Kiểm trong cùng native lock trước ghi: tạo/sửa/xóa giao dịch thu chi; chuyển quỹ (cả ngày cũ và ngày mới khi đổi ngày); hóa đơn/công nợ và các đường import/batch/consumer liên quan. Rà soát những đường ghi chưa gọi guard hiện tại. Không tự chuyển sang hôm nay để né khóa.
- Chứng từ điều chỉnh cho ngày đã đóng: ghi ở ngày mở theo quy trình duyệt, tham chiếu chứng từ/ngày gốc; mở lại ngày chỉ bằng quyền và lịch sử riêng nếu chính sách cho phép.
- Không đổi schema hoặc sửa lịch sử khi chưa có kế hoạch di trú và bản sao dự phòng được chủ duyệt.

## Tiêu chí duyệt triển khai thật

Kiểm trên copy: ngày mở ghi được; ngày đã chốt bị chặn; sửa ngày mở về ngày chốt và sửa/xóa chứng từ gốc ngày chốt đều bị chặn; THU/CHI/CHUYEN_QUY/công nợ, import và consumer; biên nửa đêm theo giờ Việt Nam; hai lần ghi và chốt đồng thời; lỗi đọc CHOT_SO; phân quyền; hồi quy Finance. Sau đó gửi phạm vi diff, kết quả và kế hoạch khôi phục để chủ duyệt riêng. Không push/deploy bằng pipeline nối bản sao.
