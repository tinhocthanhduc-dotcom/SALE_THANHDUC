# Đơn đầu tiên để đối chiếu bản sao

Chỉ dùng dữ liệu và số tiền mẫu trên staging/các bản sao đã pin. Đánh dấu yêu cầu đơn `TEST_DONGBO_20261015`. Không backfill đơn cũ; không reset số dư/tồn đã có trong bản sao.

## Trước đơn thử

1. Hai consumer: setupCopyConsumer đã báo marker đúng; enableCopyConsumer thành công. Cần xác minh kết quả Run/trigger thực, không chỉ suy từ việc push code.
2. Điều phối Script Properties: DISPATCH_BRIDGE_ACTOR_ID = admin (admin hoạt động, director); Run installDispatchOutboxPump.
3. Giám đốc → Gán Finance: cash → Tiền nhân viên đang giữ; cash_fund → Quỹ tiền mặt; goods → Thu bán hàng; service → Thu dịch vụ; thợ thử → ID nhân viên Finance tương ứng. Chọn ID từ dropdown; thiếu người/tài khoản thì dừng để quản lý xử lý, không chọn người/tài khoản khác cho qua. Khách credit gán ID_KH trước test credit riêng.
4. Trong Thanh toán / cấu hình, sửa ACB/TCB để chọn tài khoản Finance hiện hữu + số/chủ tài khoản, Lưu một lần. Hình thức tự gắn tài khoản, thợ không chọn riêng. Thử API TCB + account ACB phải bị PAYMENT_ACCOUNT_MISMATCH; cấu hình xong nhưng đổi lại trước khi xác nhận thì PT cũ vẫn giữ đúng tài khoản đã chốt.
5. Lưu số dư ban đầu của ba tài khoản trên copy và tồn SKU thử ở kho 58; bật Đồng bộ ở Điều phối cho copies.

## Đơn mẫu và kết quả phải thấy

| Bước | Thao tác | Đối chiếu |
|---|---|---|
| Nhận đơn | Hàng giao kèm: một SKU TD có tồn ≥2 ở kho 58, SL 2, đơn giá 50.000đ | Có PX Điều phối nhưng chưa có OUT ghi Kho |
| Thợ lấy | Giao/nhận/hẹn, xác nhận lấy 2 | Kho copy ghi OUT 2; tồn giảm 2; số PXK trả về |
| Thực hiện | Giao khách 1, mang về 1; công 100.000đ và khách đồng ý, đủ ảnh/điều kiện nghiệm thu | Tổng = 50.000 hàng + 100.000 công = 150.000đ |
| Trả | Kho xác nhận nhận lại 1 | IN 1, số PNK; tồn cuối giảm ròng 1 so với trước |
| Thu cash | Thợ báo 100.000đ | PT; Finance THU tổng 100.000 vào tài khoản nhân viên giữ; chưa là tiền về quỹ |
| Thu ACB | Thợ báo 50.000đ, kế toán xác nhận | Trước xác nhận chưa sang Finance; sau xác nhận THU tổng 50.000 vào bank ACB |
| Nộp quỹ | Thợ lập NQ 100.000; kế toán nhận thực tế 90.000 và ghi lý do thiếu | CHUYEN_QUY 90.000, không tạo doanh thu mới; còn 10.000 ở thợ |
| Chạy lại | receiveFromDispatch và Nhận kết quả thêm lần nữa | Không tăng lại tồn, thu hoặc chuyển quỹ; giữ số phiếu |
| Đóng | Thử đóng khi thiếu 10.000, rồi nộp/xác nhận nốt 10.000 và đồng bộ | Lần đầu bị chặn; lần sau đủ vật tư/tiền/job thì đóng được |

Đối chiếu **chênh lệch** số dư với trước test vì copy có sổ cũ: sau NQ thiếu, tài khoản nhân viên giữ tăng ròng 10.000, quỹ tăng 90.000, ACB tăng 50.000. Sau nộp bổ sung, thợ giữ về chênh lệch 0, quỹ tăng 100.000.

Finance native một dòng chỉ có một danh mục: PT trộn hàng/công có thể được tách 2 THU, external key từng danh mục. Kiểm tổng theo PT và tỷ lệ billing; không coi hai dòng danh mục là hai lần thu. NQ là chuyển quỹ, không cộng vào tổng doanh thu/thu khách.

## Làm mới thủ công để kiểm ngay

Trong editor Kho/Finance Run receiveFromDispatch; trong Điều phối → Đồng bộ → Nhận kết quả. Sau đó chạy lại để kiểm replay. Tự động consumer + pump hai chu kỳ 5 phút có thể cần gần 10 phút, phụ thuộc lịch Google; lúc tắt màn hình app cập nhật khi mở lại.

Chỉ ghi UAT đạt sau khi xem ledger/số phiếu/số dư thật trong copy. Các case thiếu gán, tồn âm, ngày chốt, công nợ, sai quyền và kho 145 tiếp tục ở bộ UAT đầy đủ; đơn đầu này chưa thay thế toàn bộ kiểm thử.
