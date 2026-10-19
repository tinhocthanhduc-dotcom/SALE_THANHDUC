# UAT chỉ bản sao

Không chạy trên file thật hoặc đưa dữ liệu khách thật vào GitHub/log. Khởi tạo project Danh bạ riêng, cấp hai tài khoản finance/director khác nhau, owner Run runCustomerDirectoryCopyUat. Ghi riêng kết quả pass/failed; deploy/Node pass không thay kết quả GAS.

| Ca | Kết quả cần thấy |
| --- | --- |
| Công ty MST trùng, cá nhân SĐT trùng (có +84/khoảng trắng) | Chặn, trả khách đã có; không cấp thêm KTD |
| SĐT của công ty | Cảnh báo, chọn thêm liên hệ hoặc tạo riêng với lý do |
| Tìm Nguyễn/nguyen, phần số, MST, KTD, SALE:… | Đúng khách, tối đa 20; đã gộp ra đích |
| Hai người tạo cùng lúc cùng MST | Một khách, người còn lại nhận trùng; không trùng mã |
| Kinh doanh sửa TEN/MST/quyền nợ bằng API | FORBIDDEN dù payload tự gửi roles |
| Hai người sửa cùng VERSION | Người thứ hai VERSION_CONFLICT |
| Gộp nguồn vào đích | Nguồn DA_GOP, alias và lịch sử giữ, version hai phía tăng |
| Mất phản hồi/retry cùng key | Một mã, một lịch sử, cùng kết quả; đổi payload/actor bị chặn |
| Duyệt nhóm tên giống/SĐT khác và SĐT giống/tên khác | Giữ Cùng/Khác khi quét lại; có nợ phải thêm GD khác người duyệt |
| Cùng MST nhưng có nợ | Chưa đủ KT+GD thì không cấp mã |
| Dữ liệu nguồn thay đổi sau duyệt | Yêu cầu duyệt lại, version tăng; bản cũ không duyệt được |
| Duyệt Khác khách mâu thuẫn liên kết Cùng khách | Chặn, không ghép âm thầm |
| Quét/cấp lần 2 | Mã/mapping không đổi, allocated=0 |
| Hàng thiếu cả SĐT và MST | Vẫn giữ khách riêng, có số đếm trong report; không bỏ dòng |
| Finance NCC riêng/vừa KH-NCC | Bỏ NCC riêng; chỉ lấy LA_KHACH_HANG=true |
| Thiếu sổ nợ hoặc snapshot Điều phối chưa yên | Dừng, không coi là hết nợ hoặc dùng snapshot chưa hoàn tất |
| Màn 390px, bàn phím, nhập nhanh rồi Enter | Không tràn ngang, Arrow/Enter/Esc/Tab; không chọn kết quả của từ khóa cũ |
| Fake client/HMAC cũ/đổi actor hoặc payload | Không mở Sheets, không ghi |

Sau UAT giả, tạo đúng bốn bản sao và quét. Ghi số nguồn/nhóm/thiếu thông tin vào báo cáo riêng; **chưa có kết quả các số này trước khi chủ tạo cấu hình copy**. Kế toán duyệt, giám đốc xác nhận nợ, cấp mã và đối chiếu ANH_XA với nguồn. Không điền MA_KHACH_CHUNG vào app nào ở bước này.

## Khôi phục

Không rollback Sheet về phiên cũ riêng lẻ, không giảm/xóa counter và không tái dùng mã. Khi ghi dở, để app phục hồi journal rồi mới làm tiếp; JOURNAL_CORRUPT/COUNTER_* phải dừng và kiểm tra backup. Có thể triển khai lại đúng reader tương thích trong project Danh bạ riêng; không deploy app cũ để xử lý Danh bạ. Quyết định gộp nhầm cần người có quyền xử lý có lịch sử trên bản sao, không sửa/xóa dòng gốc âm thầm; chưa làm tách khách đã gộp.
