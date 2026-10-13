# Đặc tả app Điều phối dịch vụ – Thành Đức

**Bản 1.1 – điều chỉnh để xây dựng và thử nghiệm, ngày 13/10/2026.**

Nguồn: “Đặc tả app Điều phối dịch vụ – Thành Đức.docx” ngày 13/10/2026 và Luồng 1 do anh Tuấn cung cấp. Bản này làm rõ thiết kế; không tự phê duyệt hạn mức, giá, quyền vận hành, nhập dữ liệu thật hoặc triển khai. Tài liệu gốc được giữ nguyên.

## 1. Mục tiêu, phạm vi và cách triển khai

Mục tiêu bản đầu: cuối ngày điều phối/giám đốc biết từng đơn đã làm đến đâu, đang chờ gì, ai phụ trách, lịch hẹn nào trễ, vật tư ai giữ và khoản tiền nào chưa được đối soát.

Bản đầu chỉ làm đơn dịch vụ kỹ thuật tại địa chỉ khách. Tất cả lần thợ đi xử lý đều có đơn và lịch sử. Một đơn có thể có nhiều lần đến khách, nhiều lần chờ linh kiện và nhiều lần cấp vật tư; không tạo đơn mới chỉ vì phải quay lại.

Phạm vi triển khai gồm: khách/máy; tiếp nhận; giao và giao lại; thợ nhận việc và chốt lịch; thực hiện/chờ linh kiện; công dịch vụ và vật tư thực dùng; đề nghị giá; nghiệm thu/không làm được; báo thu và xác nhận thanh toán; đối soát nộp tiền mặt tối thiểu; nhắc việc; lịch sử và phân quyền máy chủ.

Nộp quỹ tối thiểu được đưa vào bản đầu để kiểm tra mục tiêu tiền về quỹ trong ngày. Nếu bỏ phần này, nghiệm thu chỉ được kết luận tiền đã báo thu, không kết luận tiền đã về quỹ. Tạm ghi nhận xuất/nhận/trả bằng mã phiếu của app kho; không ghi hoặc tính tồn kho thật tự động.

Để bản sau: đồng bộ kho hai chiều; quyết toán kho thợ tự động; bảng kê/hóa đơn và công nợ theo kỳ; QR chuyển khoản; Zalo OA tự động; KPI chính thức; bán hàng/giao hàng và đơn kết hợp; mực định kỳ; sửa chữa tại cửa hàng.

Nền tảng đã được anh Tuấn chọn: Google Apps Script + Sheets; ảnh lưu Drive, staging riêng. Tận dụng thiết kế/component CARE cho điều phối và kỹ thuật, Finance cho phiên/quyền sau khi kiểm tra bảo mật. Không sao chép nguyên cơ chế mật khẩu hiện tại rồi mặc định an toàn. Chưa chọn tạo app mới hay mở rộng CARE production; quyết định này không cản việc xây prototype staging. Bản đầu gửi link đơn thủ công qua Zalo; không triển khai Zalo OA tự động.

## 2. Nguyên tắc dữ liệu và liên kết

- Một kho dữ liệu cho app Điều phối, không chia file theo vai trò. Các app Kho/Finance hiện có vẫn giữ dữ liệu do mình quản lý; kết nối bằng mã nguồn và contract. “Chung dữ liệu” không có nghĩa nhiều app cùng sửa một chứng từ.
- Mỗi đối tượng có UUID nội bộ bất biến và mã hiển thị tự cấp; không dùng số dòng Sheets làm ID. Lưu liên kết hệ thống nguồn theo source + source_id, duy nhất trong từng namespace.
- Mã khách hiển thị KH000123 chỉ dùng trong namespace Điều phối; không suy đoán cùng mã với app khác là cùng khách. Trùng điện thoại cảnh báo để người có quyền kiểm tra, không tự gộp. MST và máy cần đối chiếu khi liên kết.
- Quy tắc đã chốt trước đây cho ERP là TD-YYYYMMDD-0001. Bản gốc mới đề xuất DV-YYMMDD-STT cho app Điều phối. Trước UAT phải chọn: giữ TD cho đơn chung, hoặc DV là mã riêng và có erp_order_id/erp_order_no để liên kết. Không tự đổi mã đã cấp. Đây là quyết định còn mở, không phải thay quy tắc TD đã chốt.
- Tất cả mã biên nhận, đề nghị, phiếu nội bộ được tự cấp khi lưu; người dùng không nhập mã. Mã giao dịch ngân hàng và mã phiếu kho ngoài là trường riêng để đối chiếu.
- Cấp số trong khóa và commit nghiệp vụ, gửi lại cùng command key không tạo thêm đơn/phiếu. Không tái sử dụng số chứng từ đã hủy; lần gửi thất bại chưa commit không được báo đã cấp thành công.
- Ngày nghiệp vụ Asia/Ho_Chi_Minh; timestamp lưu thời điểm thống nhất và hiển thị theo Việt Nam. Giá và tiền VND nguyên, số lượng theo độ chính xác danh mục được chốt; không tự đoán định dạng số theo locale.
- Mỗi lần sửa có version; lệnh mang expected_version. Phiên bản cũ bị từ chối và yêu cầu tải lại, không ghi đè thay đổi của người khác.

## 3. Người dùng và quyền

6–15 tài khoản dự kiến. Một nhân viên có thể được cấp nhiều quyền; giao diện lựa chọn vai trò không thay thế xác thực. Actor, quyền và phạm vi đơn lấy từ phiên máy chủ, không tin actor_id do trình duyệt gửi.

| Vai trò/quyền | Xem | Thao tác chính | Giới hạn |
|---|---|---|---|
| Điều phối | Tất cả đơn dịch vụ | Khách/máy, tiếp nhận, chỉnh thông tin trước nghiệm thu, giao/giao lại, xử lý không làm được, hủy đơn chưa phát sinh hàng/tiền | Không xác nhận thu/nộp, không ghi vật tư thực dùng thay thợ |
| Thợ | Đơn và hồ sơ máy/khách cần thiết của mình | Nhận việc, hẹn, đề nghị chuyển thợ, làm, đề xuất vật tư, xác nhận nhận, ghi thực dùng, nghiệm thu, báo thu/nộp tiền của mình | Không xem danh sách khách toàn bộ, đơn thợ khác, duyệt giá hoặc tự xác nhận tiền |
| Thủ kho | Đơn có đề xuất/cấp/trả vật tư | Duyệt/từ chối đề xuất, ghi mã phiếu kho, cấp hàng, xác nhận thực nhận trả/hỏng/linh kiện cũ | Không xem thanh toán/giá dịch vụ không cần thiết, không xác nhận thợ nhận thay thợ |
| Xác nhận thanh toán/quỹ | Đơn và chứng từ tiền cần đối chiếu | Xác nhận hoặc từ chối khoản thu, nhận tiền nộp, đối chiếu tiền đang giữ | Cấp cho kế toán hoặc giám đốc; không tự xác nhận chứng từ do chính mình báo |
| Giám đốc | Tất cả đơn và báo cáo | Cài đặt, tài khoản, duyệt giá ngoại lệ, hủy có phát sinh, duyệt mở lại và phương án xử lý | Không tự sửa vật tư/thu tiền thay người thực hiện; hành động ngoại lệ phải có lý do và lịch sử |

“Đổi mọi trạng thái” của giám đốc không phải quyền bỏ qua điều kiện bắt buộc. Chỉ có các command ngoại lệ được định nghĩa, kèm lý do; không sửa tay ô trạng thái.

Đăng nhập bằng tài khoản nhân viên và mật khẩu. Phiên 8 giờ và khóa sau 5 lần sai là cấu hình dự kiến; trước pilot chốt thời hạn khóa/cách mở, không khóa vĩnh viễn mặc định. Mật khẩu dùng hàm băm chậm phù hợp, salt riêng; không dùng SHA-256 đơn thuần làm cơ chế lưu mật khẩu mới. Kiểm quyền ở mọi truy vấn, command và tải ảnh. Thu hồi tài khoản/phiên làm mất quyền ngay. Thợ cũ mất quyền đơn sau giao lại; lịch sử và trách nhiệm với hàng/tiền đã nhận vẫn giữ để đối soát có phân quyền.

## 4. Các trạng thái độc lập

| Trục | Giá trị | Nguồn cập nhật |
|---|---|---|
| Công việc | Mới, Đã giao, Đã nhận, Đã hẹn, Đang làm, Chờ linh kiện, Không làm được, Đã nghiệm thu, Hủy | Command có quyền và điều kiện |
| Hồ sơ | Đang mở, Chờ đối soát, Đã đóng, Đã mở lại | Tính điều kiện đóng hoặc command mở lại có duyệt |
| Điều khoản thanh toán | Thu ngay, Công nợ theo kỳ | Snapshot khi tạo đơn; thay đổi có quyền/lý do |
| Mức thanh toán | Chưa thanh toán, Một phần, Đã đủ | Tính từ khoản thu/hoàn thực hiện đã xác nhận |
| Khoản thu | Chờ xác nhận, Đã xác nhận, Từ chối | Người có quyền xác nhận tiền |
| Thời điểm thu | Trả trước, Cọc, Trả sau | Thuộc tính khoản thu, không phải mức thanh toán |
| Vật tư đơn | Không có xuất thêm, Đang xử lý, Chờ trả dư, Có sai lệch, Đã quyết toán | Tính từ cấp/nhận/dùng/trả/hỏng đã xác nhận |
| Nộp quỹ | Không phát sinh, Chờ nộp, Chờ xác nhận nhận, Đã đối soát, Có sai lệch | Tính theo từng khoản tiền mặt và phân bổ nộp đã xác nhận |

Khách công nợ vẫn có mức thanh toán và số còn phải thu; nhãn Công nợ là điều khoản. Không cộng POS chưa đối chiếu, khoản chuyển khoản chờ xác nhận hoặc phiếu hoàn mới được duyệt vào số đã xác nhận.

## 5. Mô hình dữ liệu

Các trường chung: UUID, mã hiển thị nếu có, tao_luc, nguoi_tao, cap_nhat_luc, cap_nhat_boi, version. Với bảng chỉ thêm lịch sử/sự kiện, không có quyền sửa/xóa qua app. Các liên kết phải kiểm tồn tại và đúng khách/đơn trước khi ghi.

| Bảng/hồ sơ | Nội dung chính |
|---|---|
| KHACH_HANG | Tên, điện thoại dạng text, địa chỉ mặc định, khu vực/tuyến, loại khách, điều khoản TT mặc định, MST, liên hệ, ghi chú, external_keys |
| MAY | Khách sở hữu, hãng/model, serial tùy chọn, ngày hết bảo hành và căn cứ; chuyển chủ có lịch sử |
| DON_HANG | Khách/máy, snapshot địa chỉ/lỗi/điều khoản, nguồn, ưu tiên, thợ hiện tại, trạng thái công việc/hồ sơ, số tiền tính toán, lý do hủy/không làm được |
| PHAN_CONG | Đơn, thợ, giao lúc, hạn nhận, nhận lúc, kết thúc phân công, lý do giao lại; giữ các phân công cũ |
| DE_NGHI_CHUYEN_THO | Đơn/phân công hiện tại, thợ đề nghị, thợ được đề xuất, lý do, lịch bị ảnh hưởng, trạng thái chờ/chấp nhận/từ chối, điều phối xác nhận, các nghĩa vụ vật tư/tiền cần bàn giao |
| LICH_HEN | Đơn/lần đến, giờ bắt đầu và kết thúc, lịch ban đầu/hiện tại, lý do đổi, người đổi, khách đã được báo lúc/kênh nào |
| LAN_THUC_HIEN | Đơn, thợ/phân công, lần đến, bắt đầu/kết thúc, chẩn đoán, kết quả, bước tiếp theo; một đơn nhiều lần |
| CHI_TIET_DON | Dòng công/vật tư, product/service ID, snapshot tên/đơn vị/giá, số lượng tính tiền, giá thành tiền, liên kết đề nghị giá; không là sổ tồn |
| DE_XUAT_VAT_TU | Đơn/lần thực hiện, thợ đề nghị, mã kho chuẩn, lượng xin, lý do, trạng thái duyệt, người/thời điểm duyệt, từ chối có lý do |
| GIAO_DICH_VAT_TU | Từng lần cấp/nhận/dùng/trả/hỏng/linh kiện cũ; mã hàng, số lượng, nguồn Định mức/Xuất thêm, người giữ, đơn/đề xuất, mã phiếu kho ngoài, trạng thái xác nhận, người/thời điểm xác nhận |
| DE_NGHI_GIA | Dòng đơn, giá bảng snapshot, giá đề nghị, lý do, khách đồng ý lúc/bằng chứng, trạng thái duyệt, giá được duyệt, người/thời điểm duyệt |
| THANH_TOAN | Đơn, tiền dương, phương thức, thời điểm thu, người báo/thu, thời gian, external_transaction_id tùy chọn, ảnh, trạng thái xác nhận/từ chối và lý do |
| NOP_QUY và PHAN_BO_NOP | Người nộp, số tiền, tự cấp số, các khoản thu nguồn và số phân bổ, quỹ/tài khoản nhận, trạng thái, bằng chứng, người xác nhận |
| DE_NGHI_HUY_MO_LAI | Đơn, loại yêu cầu, lý do, người đề nghị/duyệt, trạng thái, phương án xử lý hàng/tiền còn tồn |
| LICH_SU_DON | Thời điểm, actor, command/action, đối tượng, giá trị cũ/mới, lý do, version, command key; chỉ thêm |
| NHAN_VIEN, VAI_TRO_QUYEN, PHIEN | Tài khoản, trạng thái, khu vực/kỹ năng, nhiều quyền, phiên được thu hồi; không trả thông tin xác thực cho client |
| ANH_DON | Đơn/lần thực hiện, loại trước/sau/biên bản/chữ ký, Drive file ID, người tải, thời điểm, trạng thái upload; quyền truy cập theo đơn |
| DANH_MUC và CAI_DAT | Bảng giá, khu vực/tuyến, lý do, danh mục nguồn kho được duyệt, SLA, hạn mức, lịch làm việc, cấu hình mã, revision và ngày hiệu lực |
| COMMAND_RECEIPT/OUTBOX | Khóa chống gửi lặp, hash payload, kết quả; công việc nhắc/tải ảnh/đồng bộ có retry và trạng thái lỗi |

Không cố giữ giới hạn “9 bảng” nếu gây ghi đè lịch sử hoặc nhập trùng số dùng. GIAO_DICH_VAT_TU là nguồn lượng thực dùng; CHI_TIET_DON chứa lượng tính tiền, có liên kết để đối chiếu, không mặc định hai lượng luôn bằng nhau. Tổng trên đơn/đề xuất là giá trị tính ra, không nhập lại bằng tay.

## 6. Chuyển trạng thái công việc

| Từ → sang | Người thao tác | Điều kiện |
|---|---|---|
| Tạo → Mới | Điều phối/giám đốc | Khách, địa chỉ, model/yêu cầu hợp lệ; mã tự cấp |
| Mới → Đã giao | Điều phối | Thợ đang hoạt động; tạo phân công và thông báo trong app |
| Đã giao → Đã nhận | Đúng thợ | Phân công hiện tại, phiên/version hợp lệ |
| Đã nhận/Đã hẹn/Đang làm/Chờ linh kiện → Đã giao thợ mới | Điều phối xác nhận đề nghị của thợ | Lý do, thợ mới hoạt động, cập nhật hẹn và báo khách; bảo toàn chẩn đoán/lần đến, tạo phân công mới |
| Đã giao → Mới hoặc Đã giao thợ mới | Điều phối | Lý do; kết thúc phân công cũ; giữ lịch sử |
| Đã nhận → Đã hẹn | Thợ | Khoảng giờ cụ thể và đã chốt với khách |
| Đã hẹn → Đang làm | Thợ | Ghi giờ đến/bắt đầu và tạo lần thực hiện; kiểm tra vật tư cần cho chuyến đã nhận hoặc có phương án được chấp nhận |
| Đang làm → Chờ linh kiện | Thợ | Đề xuất mở hợp lệ và lý do chờ; thời điểm/lịch tiếp theo |
| Chờ linh kiện → Đã hẹn | Thợ | Vật tư cần để tiếp tục đã nhận; cập nhật lịch và xác nhận báo khách |
| Đang làm → Đã nghiệm thu | Thợ | Kết quả công việc, ảnh sau, chữ ký/biên bản; dòng công/vật tư hợp lệ; giá ngoại lệ đã duyệt và khách đã đồng ý |
| Đã hẹn/Đang làm → Không làm được | Thợ | Lý do, kết quả kiểm tra, việc cần xử lý tiếp; phí nếu có theo chính sách |
| Không làm được → Đã hẹn | Điều phối | Lịch mới, báo khách, lý do và phân công hợp lệ |
| Trước nghiệm thu → Hủy | Điều phối hoặc giám đốc duyệt | Theo gate hủy, có lý do; không tự đảo tiền/vật tư |
| Đã nghiệm thu → Đang làm/Đã hẹn | Thợ thực hiện sau giám đốc duyệt mở lại | Tạo revision/lần thực hiện mới; đánh giá ảnh hưởng giá/tiền/vật tư; không xóa lần nghiệm thu cũ |

Không ép hoàn tất khi xử lý tạm hoặc khách chưa chấp nhận. Lưu kết quả lần đến: hoàn tất, xử lý tạm/chờ tiếp, không làm được, khách từ chối, cần mang máy về. Bản đầu “mang về cửa hàng” tạo việc cần điều phối xử lý và ghi bàn giao máy; không tự kết luận đã hoàn tất sửa chữa.

Thợ đã nhận có thể đề nghị chuyển khi không kịp lịch hoặc gặp tình huống cần thợ khác. Nút Chuyển thợ chọn người đề xuất (có thể để điều phối chọn), bắt buộc lý do và tình trạng hiện tại. Cách kiểm soát đề xuất cho bản đầu: điều phối chấp nhận/chọn thợ mới; tới lúc đó thợ cũ vẫn là người phụ trách và nhận cảnh báo. Thợ mới phải bấm nhận và chốt/xác nhận lại lịch. Nếu quá hạn hoặc thợ mới từ chối, điều phối tiếp tục xử lý, không để đơn không có chủ.

Khi chuyển: giữ trạng thái/chẩn đoán/lần thực hiện trước đó trong lịch sử, tạo phân công mới Đã giao. Đề xuất vật tư còn mở được người nhận mới xem tiếp; vật tư đã giao vẫn thuộc người đang giữ. Lập bàn giao giữa thợ với mã phiếu riêng, người giao/người nhận xác nhận số lượng; hoặc trả kho và cấp lại. Tiền đã thu vẫn thuộc người thu tới khi được quỹ xác nhận, không chuyển bằng cách đổi id_tho. Điều phối ghi lịch mới và thông tin đã báo khách. Không cho chuyển đơn đã nghiệm thu/đóng bằng nút chuyển thông thường; phải mở lại có duyệt.

## 7. Vật tư định mức, xuất thêm và linh kiện cũ

Thợ mang sẵn vật tư định mức theo vị trí thợ, không xuất lại cho từng đơn. Bản đầu ghi lượng dùng theo đơn và nguồn định mức; đây là bản kê đối soát, chưa chứng minh kho thợ đã bị trừ trên app kho.

Xuất thêm: thợ đề nghị trên cùng đơn → kho duyệt → kho ghi phiếu ở app kho và mã liên kết → hàng chờ bàn giao → đúng thợ kiểm đếm xác nhận nhận → sử dụng/trả/hỏng. Phê duyệt đề xuất chưa phải đã xuất; xuất chưa phải thợ đã nhận. Khi nhận thiếu/hỏng phải ghi chênh lệch và giữ việc cho thủ kho xử lý, không xác nhận đủ mặc định.

Một đề xuất có thể cấp nhiều lần và có nhiều dòng thực dùng. Số thực dùng nguồn Xuất thêm phải phân bổ tới lần nhận cụ thể; không vượt đã nhận còn khả dụng. Phần định mức và xuất thêm không tự bù nhau khi quyết toán.

Số còn phải xử lý của phần xuất thêm = đã nhận − thực dùng nguồn Xuất thêm − trả kho đã xác nhận − hỏng đã xác nhận. Trả đang chờ và hỏng mới đề nghị chưa giảm số này. Chênh lệch giữa kho xuất và thợ nhận vẫn là sai lệch bàn giao phải xử lý riêng. Lượng thực nhận trả không vượt số còn giữ; gửi lại không nhân đôi.

Đề nghị trả dư giữ chỗ để không dùng/nộp trả hai lần. Thủ kho kiểm đếm và xác nhận nhận lại. Hỏng phải có người duyệt được cấu hình và bằng chứng; không để thợ tự báo hỏng rồi tự giảm trách nhiệm. Chỉ “Đã quyết toán” khi mọi đề xuất kết thúc, không còn hàng chờ nhận, dư phải trả, hỏng chờ duyệt hoặc sai lệch.

Linh kiện cũ có bản ghi riêng: đơn/máy, mô tả, lượng, chủ sở hữu, khách đồng ý giao lại nếu thuộc khách, người giữ và kho thực nhận. Không tự nhập thành hàng mới bán được. Trách nhiệm mang về và xử lý hàng hỏng/cũ cần chính sách trước pilot.

## 8. Giá, nghiệm thu và thay đổi sau nghiệm thu

Bảng giá chuẩn hiện chưa có, anh Tuấn sẽ cung cấp sau. Trước khi có bảng giá, quản trị tạo danh mục tên/mã dịch vụ không kèm giá mặc định; thợ chọn dịch vụ và lập báo giá riêng trên đơn. Không giả lập bảng giá chuẩn hoặc mặc định giá 0 là dịch vụ miễn phí. Giá đề nghị phải được khách đồng ý, duyệt theo quyền cấu hình khi cần; mức/quyền duyệt ngoài phí kiểm tra vẫn phải chốt trước pilot. Khi bảng giá được bổ sung, áp dụng theo ngày hiệu lực cho đơn mới/điều chỉnh được duyệt, không tự đổi giá đơn cũ. Nếu có bảng giá, lưu giá bảng theo thời điểm và revision; nếu chưa có, ghi nguồn giá Báo giá riêng và lưu căn cứ/chấp thuận. Phát sinh trước khi làm phải được khách đồng ý; giá ngoài chính sách gửi đề nghị duyệt. Duyệt giá và khách đồng ý là hai xác nhận khác nhau.

Ngưỡng giảm/ngoại lệ chưa được chốt: bản thử nghiệm cho cấu hình và đánh dấu rõ; không tự áp dụng mức 5% hay bất kỳ hạn mức tiền nào. Không nghiệm thu khi đề nghị giá bắt buộc còn chờ duyệt.

Nghiệm thu lưu ảnh sau, chữ ký/biên bản, kết quả kiểm tra, dòng công, vật tư thực dùng và tổng tiền snapshot. Thu tiền là bước riêng; thiếu khoản thu không làm mất nghiệm thu.

Mở lại sau nghiệm thu cần giám đốc duyệt/lý do, tạo revision mới và giữ snapshot cũ. Phí kiểm tra/đi lại khi thợ đã đến nhưng khách từ chối sửa: anh Tuấn cho phép từ 0 đến 200.000 đồng tùy trường hợp. Lưu thành dòng phí, lý do, người ghi và căn cứ khách đồng ý; 0 đồng phải ghi rõ miễn phí, không mặc định mọi lần không làm được đều thu. Không cộng phí kiểm tra và phí đi lại để vượt tổng trần 200.000 đồng cho tình huống này. Mức vượt trần không thuộc phạm vi đã chốt, chuyển xử lý ngoại lệ. Chốt thêm trường hợp áp dụng/mức cụ thể và thời điểm thông báo phí cho khách trước pilot; app không tự áp một mức cố định.

Thay đổi tổng tiền phải đối chiếu khoản đã thu: giảm giá dưới đã thu tạo khoản cần xử lý hoàn/chênh lệch, không âm thầm cắt khoản thu; tăng giá phải có khách đồng ý và quyền duyệt tương ứng. Sau đóng, chỉ xử lý bằng hồ sơ mở lại/điều chỉnh, không sửa trực tiếp.

## 9. Thu tiền, hoàn tiền và nộp quỹ

Số còn phải thu = tổng tiền đã chốt hiện hành − thu đã xác nhận + hoàn thực chi đã xác nhận. Khoản chờ xác nhận/từ chối không tính. Bản đầu cấm nhập số âm để “hoàn”; chỉ ghi yêu cầu xử lý ngoại lệ, chưa có hoàn tự động. Nếu triển khai hoàn sau này phải liên kết thu gốc, số tiền không vượt khoản được hoàn, người duyệt và xác nhận thực chi riêng.

Tiền mặt thợ báo thu hiện thành “đã báo đang giữ” ngay để không bỏ sót trách nhiệm; tiền đã đối chiếu thể hiện riêng. Chuyển khoản chỉ vào tài khoản công ty, nội dung mã đơn; thợ báo thu, người có quyền kiểm tra và xác nhận. Không tạo mặc định khoản thu bằng toàn bộ tiền còn lại. Cho thu một phần, chặn vượt số còn được thu sau khi tính cả khoản đang chờ; thu thừa xử lý ngoại lệ riêng, không âm thầm bỏ qua.

Mã giao dịch ngoài nếu có phải chống ghi trùng theo nguồn/phương thức. Biên nhận nội bộ tự cấp; một giao dịch ngân hàng phân bổ nhiều đơn phải qua nghiệp vụ phân bổ sau này, không tạo nhiều khoản thu độc lập cùng mã. POS chờ đối chiếu theo bằng chứng; tiền POS không là tiền mặt thợ giữ. Settlement/phí ngân hàng ngoài phạm vi bản đầu.

Khách công nợ: thợ không ghi khoản thu trực tiếp; hiện “Không thu tại chỗ”. Người có quyền tài chính vẫn có thể ghi/phân bổ khoản thanh toán công ty đã nhận, có đối chiếu. Điều khoản được snapshot trên đơn, thay đổi khách mặc định không tự đổi đơn cũ.

Nộp quỹ tối thiểu: thợ lập đề nghị từ các khoản tiền mặt của mình → xác nhận đã giao tiền → kế toán/người có quyền xác nhận thực nhận. Phân bổ tới khoản nguồn; đề nghị chờ giữ chỗ để không nộp cùng tiền hai lần. Chỉ xác nhận thực nhận mới giảm tiền đang giữ. Có thể ghi một lần nộp cho nhiều đơn với phân bổ rõ ràng; số đối chiếu lấy từ phân bổ, không cộng chứng từ cha rồi cộng từng dòng lần nữa.

M8 hiển thị riêng: tiền mặt báo thu trong ngày, đã xác nhận, đề nghị nộp chờ nhận, quỹ đã nhận và số còn giữ từ các ngày. Không gọi tổng tiền mặt báo thu là tiền về quỹ. Tiền giữ không trừ phiếu hoàn mới được duyệt hoặc các khoản chi tùy ý.

## 10. Hủy và đóng hồ sơ

Điều phối được hủy khi chưa có bất kỳ khoản báo thu/thu và chưa xuất/bàn giao vật tư thêm hoặc máy. Các trường hợp có phát sinh phải được giám đốc duyệt. Duyệt hủy không thực hiện hoàn tiền, nhận lại hàng hay xóa lịch sử.

Đơn bị hủy vẫn hiển thị nghĩa vụ vật tư/tiền, người chịu trách nhiệm và phương án xử lý. Tiếp tục cho phép ghi/xác nhận thu hồi hàng và đối soát tiền của đơn hủy theo quyền; cấm tạo thêm công việc thông thường. Sau nghiệm thu dùng hồ sơ mở lại/điều chỉnh, không dùng nút hủy trước nghiệm thu.

Công việc hoàn tất không đồng nghĩa hồ sơ đóng. Hệ thống chuyển Chờ đối soát sau nghiệm thu khi còn nghĩa vụ. Được đóng khi: đã nghiệm thu; giá ngoại lệ kết thúc; không còn đề xuất vật tư mở/chờ nhận/trả/hỏng/sai lệch; mọi khoản báo thu đã được xử lý; điều khoản thu ngay đã thu đủ hoặc điều khoản công nợ đã ghi nhận số cần theo dõi; tiền mặt nguồn đơn đã nộp và được quỹ xác nhận hoặc có ngoại lệ giữ được duyệt, còn hiển thị trách nhiệm. Khoản công nợ chưa trả không tự thành bằng 0 khi đóng.

Hồ sơ hủy được đóng sau xử lý hết các nghĩa vụ phát sinh hoặc chuyển sang hồ sơ ngoại lệ được duyệt và liên kết rõ, không được đóng để che khoản tồn.

## 11. Màn hình và thông báo

| Màn hình | Nội dung/bổ sung |
|---|---|
| M1 – Tạo đơn | Tìm khách, 3 đơn gần nhất, máy/bảo hành, địa chỉ công việc, yêu cầu, nguồn/ưu tiên, lịch mong muốn và điều khoản snapshot; lưu/giao |
| M2 – Giao thợ | Khu vực/tuyến, kỹ năng, việc đang giữ, lịch; giao lại có lý do/kế hoạch bàn giao; chưa tự tối ưu tuyến |
| M3 – Bảng điều phối | Trạng thái, giờ hẹn hiện tại, cảnh báo và lý do treo; lọc ngày/thợ/tuyến; tìm mã/điện thoại |
| M4 – Chi tiết đơn | Công việc + hồ sơ, lần đến/lịch hẹn, giá, vật tư, các khoản thu/nộp, số còn phải thu, ảnh và timeline; ẩn trường theo quyền máy chủ |
| M5 – Việc của tôi | Hôm nay/đang treo; nhận đơn, lịch, hướng dẫn bước tiếp theo; không tải đơn của thợ khác xuống client |
| M6 – Làm đơn | Đề nghị chuyển thợ khi không kịp/gặp tình huống; gọi/Maps, hẹn/bắt đầu/chờ/không làm được, đề xuất/nhận vật tư, ghi lượng dùng theo nguồn, báo giá/khách đồng ý |
| M7 – Nghiệm thu và báo thu | Ảnh/chữ ký/biên bản, kết quả, tổng tiền đã chốt, thu đã xác nhận/chờ, số còn phải thu; có thể nghiệm thu khi chưa thu |
| M8 – Tổng quan | Đơn xong/treo/trễ và vì sao; tiền báo/đối chiếu/quỹ thực nhận/đang giữ tách riêng; danh sách việc cần xử lý |
| M9 – Vật tư | Duyệt/từ chối, chờ xuất/nhận, các lần cấp, mã phiếu app kho, trả/hỏng/cũ, sai lệch và đối soát |
| M10 – Xác nhận tiền/quỹ | Chờ xác nhận thu, từ chối có lý do, đề nghị nộp và phân bổ, xác nhận thực nhận, đối chiếu số đang giữ |
| M11 – Quản trị | Nhân viên/quyền, bảng giá/danh mục, SLA/hạn mức và ngày hiệu lực; lịch sử cấu hình |

Thông báo trong app và nút sao chép link đơn để điều phối gửi Zalo. Link chỉ chứa ID, không chứa mật khẩu/token; mở vẫn phải đăng nhập và kiểm quyền. Đã chọn gửi link thủ công qua Zalo ở bản đầu; Zalo OA tự động ngoài phạm vi.

Ảnh nén mục tiêu khoảng 200–300 KB, không làm mất khả năng đọc biên bản; hạn kích thước/loại được cấu hình. Upload có ID chống gửi lặp, trạng thái chờ/thành công/lỗi và nút thử lại. Mất sóng không báo nghiệm thu thành công; chỉ hoàn tất khi server xác nhận ảnh đã lưu. Không để ảnh khách/máy trong thư mục Drive công khai; quyền tải ảnh theo đơn.

## 12. Cấu hình thời gian và cảnh báo

| Cảnh báo | Giá trị thử nghiệm từ bản gốc | Điều kiện |
|---|---|---|
| Chưa giao | 15 phút; khẩn 5 phút | Mới quá hạn, tới điều phối |
| Chưa nhận | 30 phút | Phân công hiện tại chưa nhận, tới thợ/điều phối |
| Trễ hẹn | Quá giờ kết thúc lịch hiện tại | Chưa bắt đầu; giữ lịch ban đầu để báo cáo đổi hẹn |
| Chờ linh kiện | 2 ngày | Chờ và chưa có lịch/giải pháp mới, tới điều phối/giám đốc |
| Không làm được | 1 ngày | Chưa xử lý tiếp, tới điều phối/giám đốc |
| Đề xuất chưa duyệt | 2 giờ | Đề xuất hiện hành chờ duyệt, tới kho |
| Trả dư | 3 ngày sau nghiệm thu | Còn lượng phải xử lý, tới thợ/kho |
| Chuyển khoản chờ | 1 ngày | Chưa xác nhận/từ chối, tới người xác nhận tiền |
| Tiền mặt chưa nộp | Chưa chốt giờ cắt/ngày | Phân biệt chưa lập đề nghị với quỹ chưa xác nhận nhận |

Mọi mốc là đề xuất, không tự dùng chấm KPI/vi phạm. Cần chốt lịch làm việc, cách tính ngoài giờ/ngày nghỉ, giờ cắt tiền và ngoại lệ. Khi chưa cấu hình không tự tạo hạn mức 3 ngày/5 triệu. Nhắc việc có trạng thái đã xử lý và chống gửi trùng, không chỉ đổi màu thẻ. Lưu snapshot cấu hình hạn trên hồ sơ, đổi cài đặt không âm thầm đổi lịch sử hạn đã áp dụng.

## 13. Kỹ thuật, độ bền và bảo vệ dữ liệu

Apps Script cần thiết kế khóa ghi, command receipt, journal/recovery và tác vụ đối chiếu khi ghi nhiều bảng; LockService không tự biến nhiều lệnh ghi Sheets thành transaction. Không báo thành công khi chỉ ghi được một phần. Retry sau lỗi không cấp thêm số, thêm khoản thu hoặc trừ vật tư lặp.

Máy chủ tính giá/số còn thu/phân bổ và kiểm mọi FK/quyền/version; không tin các tổng từ client. Không chạy bootstrap/migration legacy trong truy vấn đọc. Các thao tác lấy danh mục/ảnh chỉ trả thông tin cần cho vai trò, không đọc mật khẩu/phiên để trả ra UI.

Mục tiêu cần đo trên staging: mở M5 dưới 3 giây, cập nhật trạng thái dưới 2 giây ở p95 với tập dữ liệu và số người đồng thời đại diện; ghi rõ cache nóng/lạnh, ảnh đo riêng và tình huống 4G. Nếu không đạt, sửa cách phân trang/cache/ghi theo batch hoặc đánh giá nền tảng trước pilot; chưa cam kết từ đặc tả.

Sao lưu ngày, giữ 30 bản là mục tiêu cấu hình; lưu cả dữ liệu và danh sách/file ảnh cần khôi phục, quyền truy cập riêng. Phải thử phục hồi vào staging và đối chiếu mã, số dư, lịch sử, ảnh. Backup chỉ tồn tại không chứng minh khôi phục được. Cần chốt mức mất dữ liệu và thời gian phục hồi chấp nhận trước pilot.

Nhập khách theo bản sao/export được phép, giữ khóa nguồn. Điện thoại text và không tự bổ sung số 0; xung đột/thiếu ID đưa vào danh sách review. Không ghi ngược Sale/Care/Finance hoặc sửa quyền production trong bước nhập thử.

## 14. Nghiệm thu theo giai đoạn

Giai đoạn 1: fixture/prototype, không dữ liệu thật. Giai đoạn 2: staging riêng với auth, ảnh, phục hồi và đối soát. Giai đoạn 3: pilot 2 tuần sau khi chốt chính sách và phê duyệt môi trường. Mock/local test không thay thế nghiệm thu Apps Script thực tế.

| Ca kiểm thử | Kết quả phải đạt |
|---|---|
| Tiếp nhận | Tìm/tạo khách và máy, tạo/giao đơn dưới 2 phút trong bài thử; không gộp khách chỉ theo điện thoại |
| Thợ xử lý | Nhận → hẹn → làm → nghiệm thu trên điện thoại; có ảnh sau/chữ ký hoặc biên bản |
| Vòng chờ | Làm → chờ → nhận hàng → hẹn lại → làm, lặp nhiều lần trên cùng đơn; giữ mọi lịch/lần đến |
| Giao lại/chuyển thợ | Thợ đề nghị, điều phối xác nhận, thợ mới nhận; trong lúc chờ không mất chủ; thợ cũ không sửa đơn sau chuyển; hàng/tiền không chuyển trách nhiệm tự động |
| Phí kiểm tra | Từ 0 đến 200.000 theo trường hợp, có lý do và khách đồng ý; tổng hai loại phí không vượt trần; không tự thu khi khách từ chối |
| Phân quyền | Thợ A gõ URL/API mã đơn B bị chặn; kho không lấy được dữ liệu tiền; client giả actor/role bị từ chối |
| Giá | Ngoại lệ chưa duyệt không nghiệm thu; giá cũ được snapshot; sửa sau nghiệm thu có duyệt và revision |
| Vật tư | Định mức/xuất thêm tách lượng dùng; cấp nhiều lần, nhận thiếu, trả/hỏng chưa xác nhận không giảm số còn phải xử lý |
| Thu tiền | Khoản chờ không giảm phải thu; công nợ không cho thợ báo thu; không ghi trùng giao dịch, thu vượt hoặc số âm |
| Nộp quỹ | Đề nghị chưa giảm tiền giữ; xác nhận thực nhận mới giảm; không nộp lặp hoặc tự xác nhận |
| Hủy/mở lại | Hàng/tiền phát sinh cần duyệt; hủy không đảo dữ liệu; mở lại không xóa nghiệm thu và khoản thu cũ |
| Đồng thời/retry | Hai người cùng version: một thành công, một conflict; lỗi sau ghi một phần có recovery và retry không nhân đôi |
| Ảnh/mất sóng | Upload gửi lại không trùng; ảnh chưa lưu không báo nghiệm thu thành công; file riêng tư và đúng quyền |
| Đóng | Công nợ còn phải thu vẫn giữ; nghĩa vụ hàng/tiền chưa xử lý không bị che khi đóng; cảnh báo đúng |
| Hiệu năng/backup | Đo mục tiêu trên staging; khôi phục dữ liệu/ảnh vào file riêng, đối chiếu thành công |
| Pilot | 100% đơn dịch vụ thuộc phạm vi pilot đi qua app; tổng đơn và tiền M8 đối chiếu tay đúng, phân biệt thu và quỹ nhận |

## 15. Quyết định đã được cung cấp – 13/10/2026

- Phí kiểm tra/đi lại khi tới khách nhưng khách từ chối sửa: từ 0 đến 200.000 đồng tùy trường hợp; không phải mức thu cố định.
- Nền tảng: tiếp tục Google Apps Script + Sheets.
- Thông báo bản đầu: điều phối gửi link đơn thủ công qua Zalo.
- Chưa có bảng giá chuẩn; anh Tuấn sẽ bổ sung sau. Không tự tạo bảng giá để áp dụng cho nhân viên.
- Thợ nhận đơn nhưng không kịp hoặc gặp tình huống được chuyển sang thợ khác. Đã bổ sung đề nghị chuyển, xác nhận điều phối và nhận việc/bàn giao của thợ mới. Trình tự kiểm soát cụ thể là thiết kế đề xuất, chưa phải ma trận quyền cuối cùng.

## 16. Các quyết định còn cần chốt trước pilot

1. Mức phí cụ thể theo tình huống trong khoảng đã cho phép, miễn phí/bảo hành và thời điểm thông báo khách. Trần tổng 200.000 là cách diễn giải để không thu chồng hai phí; cần xác nhận khi chuẩn hóa chính sách.
2. Hạn nộp tiền: trong ngày theo Luồng 1 hay hạn giữ; giờ cắt, ngày nghỉ, ngoại lệ và người duyệt. Đối soát hằng ngày không đồng nghĩa đã nộp tiền.
3. Quyền duyệt báo giá riêng khi chưa có bảng giá, hỏng vật tư, người duyệt thực tế và tình huống kiêm nhiệm. Không tự chốt người vừa báo vừa xác nhận.
4. Bộ mã đơn: TD đã chốt cho ERP hoặc DV riêng app có mapping; không đổi số chứng từ cũ.
5. Khu vực theo quận hay tuyến; khung sáng/chiều, lịch làm việc và SLA đề xuất.
6. Danh mục công để nhập trước bảng giá, danh mục vật tư kho và cách cấp/đối soát định mức; mẫu dữ liệu được phép dùng thử.
7. App Điều phối độc lập hoặc mô-đun CARE; project/file staging riêng và mục tiêu phục hồi. Chọn nền tảng không cho phép deploy vào CARE hiện hành.
8. Chốt ma trận quyền chuyển thợ và bàn giao; kế hoạch pilot và người nghiệm thu.

Những câu hỏi này không chặn viết mẫu giao diện, contract, fixture và test. Chặn các thao tác thực tế liên quan khi chưa có quyết định/quyền/dữ liệu. Không coi bản tài liệu này là phê duyệt chạy workflow triển khai hoặc ghi production.
