# Điều phối dịch vụ – trạng thái ngày 13/10/2026

App có máy chủ local và Apps Script staging riêng; Google đã khởi tạo và người dùng đã kiểm tra luồng nhận đơn, giao/nhận/hẹn/bắt đầu, chuyển thợ, ảnh và nghiệm thu. Project/deployment hiện tại lưu trong `ops/service-staging-20261013-01.project.json`. Cập nhật dùng lại project/deployment này, giữ nguyên Sheets, Drive, Script Properties và tài khoản.

## Sửa sau UAT

- Có hàm public `provisionDispatchUser`, kiểm tra Google active/effective user giống `setupDispatchStaging`. Cấp thợ qua hai Script Properties tạm, xóa sau xử lý; README hướng dẫn đúng hàm public. Chưa có màn hình quản trị tài khoản.
- Login băm ngoài ScriptLock, rồi đọc lại tài khoản, version, hash, salt, tham số và lockout trong khóa trước khi ghi. Kiểm thử thay đổi tài khoản/khóa đồng thời và số lần thất bại không bị ghi đè. Giữ PBKDF2-SHA256 600.000 vòng, tương thích tài khoản cũ.
- Thêm `benchmarkDispatchPassword` chỉ chủ project chạy được; đo chuỗi tổng hợp và log `hash_ms`, không đọc mật khẩu nhân viên. **Chưa có số đo thời gian GAS thực tế**: môi trường này không có phiên OAuth cục bộ để gọi function trên Google; workflow clasp chỉ push/deploy. Cần chạy phép đo trong editor trước khi quyết định thay thuật toán hoặc số vòng.
- Nhận đơn cho phép bỏ trống cả hai giờ, khu vực khách không bắt buộc. Khoảng giờ nhập một đầu hoặc sai thứ tự bị chặn. Thợ đã nhận đơn có giờ hẹn được Bắt đầu ngay; chưa hẹn cần chốt lịch trước.
- Điện thoại có link gọi, địa chỉ có Google Maps, lịch sử tiếng Việt và tên nhân viên, giờ không có giây, máy không serial không có dấu phân cách thừa.
- Form điện thoại báo lỗi ngay khi nhập chữ. Thợ chỉ thấy tab Việc của tôi; mở đơn đưa chi tiết vào tầm nhìn và có nút quay lại danh sách trên điện thoại.

## Kiểm chứng

31/31 kiểm thử Node đạt, không bỏ qua; gồm domain, HTTP/auth, recovery và GAS bundle/bridge với workbook giả lập. 27 kịch bản Chromium end-to-end đạt, không có page error. 71/71 kiểm thử ERP cũ đạt. Kết quả lưu `test-results.txt` và `browser-results.json`. Đây là kiểm chứng local/giả lập GAS, không thay thế nghiệm thu runtime Google.

Quyền command/query/ảnh kiểm tra trên máy chủ. Số đơn TD tự cấp; phân công/lịch/lần đến được lưu; chuyển thợ giữ trách nhiệm người cũ đến khi duyệt rồi thu hồi quyền. Nghiệm thu cần ảnh sau và biên bản của lần đến hiện tại. Ảnh private, replay/recovery giữ file đã được journal nhận. Các guard staging/marker và chặn 5 project legacy vẫn giữ.

## Phần còn lại

Giá/phí kiểm tra 0–200k, báo giá và duyệt; dòng công; định mức kho thợ, vật tư hỏng, xuất/nhận từng phần và đồng bộ app Kho; thu tiền/nộp quỹ/đối soát; quản trị tài khoản trên UI; ký vẽ, backup lịch và nhập dữ liệu nguồn. Nghiệm thu hiện giữ hồ sơ Chờ đối soát, không đồng nghĩa đóng hồ sơ tài chính hoặc hoàn thành toàn bộ SPEC_V1_1.

Tiếp tục UAT Google với tài khoản thợ được cấp bằng `provisionDispatchUser`, kiểm tra các điểm sửa và chạy benchmark trong editor. Không cần chạy lại setup hoặc đổi mật khẩu sau cập nhật mã. Tài khoản fixture local công khai không được đưa lên Google.

## Bổ sung bàn giao kho và thu máy cũ

Đã có trên mã staging: Kho/Giám đốc xuất đủ đề xuất với mã PX tự cấp → thợ nhận → tiếp tục cùng lần đến hoặc hẹn lại/new visit; ghi số thực dùng, tính dư và kho xác nhận trả với mã PN. Tạo biên nhận BN máy thu từ khách và kho nhận với mã NK, lưu tình trạng/phụ kiện, serial, mục đích và người đang giữ. Phiếu theo đơn được lưu trong journal/Sheets hiện tại; không đồng bộ tồn kho app Kho hoặc định giá máy cũ. Đơn đang Chờ linh kiện và tài khoản cũ được giữ nguyên.

Quyền kho/director, thợ được giao, replay/version, chặn tiếp tục khi chưa nhận, vật tư vượt số xuất, chặn chuyển bỏ lại tài sản và giám đốc duyệt hủy được kiểm thử. GAS bridge giả lập chạy thêm xuất/nhận/tiếp tục/ghi dùng/thu máy/nhận kho. Chromium chạy xuyên suốt thợ → kho → thợ, hoàn trả dư, chuyển thợ, máy cũ và nghiệm thu; không có page error. Cần UAT các bước mới trên Google. Admin hiện tại có vai trò director nên thử kho được ngay, không cần tạo tài khoản kho trước.

## Xử lý trắng màn hình sau gửi đăng nhập

Theo mô tả người dùng: giao diện trước đăng nhập hiện được, trắng sau gửi form. Chưa có log/Console của phiên Google để xác nhận nguyên nhân cụ thể. Đã chặn native navigation, nút riêng/Enter handler, khóa nút trước bootstrap/trong login, chỉ ẩn form sau query/render thành công, kiểm tra cấu trúc dữ liệu trả về và thông báo lỗi bootstrap độc lập.

28/28 Node và 25 kịch bản browser cũ vẫn đạt. Bộ browser mới kiểm gói GAS inline trong iframe sandbox với callback giả lập: 8 kịch bản, gồm đơn Chờ linh kiện hiện có, login/nút/Enter không điều hướng, lỗi bridge, null/malformed query giữ form và retry, bootstrap lỗi chặn submit và báo mã. Có kết quả `gas-ui-browser-results.json`. CI chạy thêm bộ này. Chưa xác minh đã hết lỗi trên Google thực tế; cần người dùng UAT bản cập nhật với phiên hiện tại.

## Chẩn đoán lỗi bootstrap trên Google

Người dùng thấy UI_RUNTIME_ERROR với nút đăng nhập bị khóa ngay khi tải: script chưa đến bước gắn handler. Artifact Index.html đã đối chiếu khớp nguồn, hai inline script parse được local. Chưa có dòng Console thực tế để xác định nguyên nhân. Bootstrap hiển thị thêm loại lỗi và dòng/cột; chỉ lỗi cú pháp hiển thị thông báo parser rút gọn, không log tài khoản/token/mật khẩu hoặc URL. Đây là bổ sung chẩn đoán, chưa phải xác nhận đã sửa nguyên nhân trên Google.

## Lỗi cú pháp trong Google document.write

Console người dùng xác nhận `SyntaxError: Failed to execute write on Document: missing ) after argument list`, trước khi script giao diện gắn handler. Cảnh báo unload không phải lỗi chặn đăng nhập. Chưa có bản nguồn đã được Google biến đổi để xác định ký tự gây lỗi.

Đã đổi đóng gói GAS: frontend được esbuild chuẩn hóa ES2017/ASCII, bỏ template literals; nguồn nằm trong payload base64 tĩnh và được loader nhỏ gắn qua script.text vào DOM. HTML truyền qua document.write không còn chứa mã ứng dụng với các chuỗi HTML lồng nhau. Loader kế thừa nonce nếu có; không eval mã từ người dùng hoặc tải thêm dịch vụ ngoài.

Kiểm thử GAS UI đổi sang document.write trong iframe sandbox, chạy đăng nhập, đơn Chờ linh kiện cũ, Enter, retry, dữ liệu lỗi và lỗi cú pháp thực sự ở bootstrap; thêm CSP nonce. 9 kịch bản đạt cùng 28/28 Node; cần người dùng UAT lại trên Google để xác nhận lỗi thực tế đã hết. Giữ nguyên cấu hình, tài khoản, dữ liệu và deployment.

## Giảm nhập tay ở các xác nhận nghiệp vụ

Người dùng yêu cầu thông tin chuẩn chỉ cần chọn/đánh dấu. Nghiệm thu chuyển sang checklist giao máy/cài đặt/sửa chữa/vệ sinh/chạy thử/hướng dẫn, xác nhận khách nghiệm thu và ghi chú ngoại lệ tùy chọn. Hàng status received hiện ngay trong form, số thực dùng/giao điền sẵn theo số xuất và sửa được (0 đến số đã nhận); cần đánh dấu xác nhận, không mặc định đã dùng hay đã nghiệm thu. Số dùng và nghiệm thu lưu trong một command/version/journal, không cần mở form ghi dùng riêng. Phần dư vẫn chờ kho nhận.

Xác nhận xuất, nhận, trả hàng, chốt giờ, tiếp tục, khách giao máy và kho kiểm nhận chuyển thành checkbox; ghi chú ngoại lệ tùy chọn. Form ghi dùng riêng có dropdown nội dung và số lượng điền sẵn; đổi hàng cập nhật giới hạn/số mặc định và bỏ dấu xác nhận cũ. Form nghiệm thu hiển thị tình trạng ảnh của đúng lần đến và chặn lưu nếu chưa đủ ảnh hoặc còn giao hàng/chuyển thợ chưa xử lý. Model/serial, lỗi thực tế và vị trí kho vẫn cần thông tin đúng, không tự dựng danh mục.

Kiểm chứng: 31/31 Node đạt, gồm complete gộp atomic/replay, lỗi ảnh không trừ vật tư, sai lượng/thiếu/trùng dòng/xác nhận bị chặn; 27 kịch bản HTTP browser đạt, gồm checklist không gõ mô tả, số lượng tự điền và lưu một version; 9 kịch bản gói GAS/document.write/CSP đạt. Dữ liệu cũ và API complete với work_summary cũ vẫn tương thích, không chạy setup lại. Cần UAT form mới trên Google.

Lựa chọn Chưa sử dụng tự điền 0; sửa lượng sẽ bỏ xác nhận cũ, tránh giữ dấu tích cho số khác. Browser test kiểm tra lựa chọn, chỉnh lại lượng và checkbox trước khi lưu.

## Mở web app không cần Gmail

Theo yêu cầu người dùng, manifest webapp chuyển access sang ANYONE_ANONYMOUS, executeAs vẫn USER_DEPLOYING. Nhân viên vẫn phải đăng nhập user/password; quyền đọc đơn/ảnh/command dựa vào phiên máy chủ. Các hàm setup/provision/health/benchmark tiếp tục chặn Google active user trống hoặc khác effective user. Không đổi tài khoản, mật khẩu, Sheets/Drive hoặc 5 app legacy.


## Tối giản tiếp nhận và thao tác thợ (2026-10-13)

- Nhận đơn bỏ chọn/tạo máy; model được ghi trong yêu cầu. Domain nhận machine_id trống, không tự tạo hồ sơ giả; dữ liệu và API hồ sơ máy cũ giữ nguyên.
- Giờ tiếp nhận tùy chọn: chưa chốt / sáng / chiều / cả ngày / khoảng tùy chỉnh. Hai ô chỉ chọn giờ; ngày do máy chủ lấy theo Việt Nam. Kiểm thử qua ranh giới ngày UTC, bỏ qua service_date do client gửi, chặn khoảng thiếu đầu hoặc sai thứ tự. Đơn chưa hẹn vẫn cần chốt lịch trước Bắt đầu.
- Giao/giao lại thợ dùng Ghi chú không bắt buộc; lịch sử phân công và kiểm tra bàn giao tài sản giữ nguyên. Đề nghị chuyển thợ vẫn cần lý do.
- Đề xuất nhiều loại trong một phiếu DX, thêm/xóa dòng và chọn nhu cầu. Kho xuất cả phiếu với một mã PX, thợ nhận cả phiếu một lần; kiểm tra toàn bộ dòng trước khi ghi, replay không cấp số trùng. Đề xuất cũ một dòng tương thích. Tên linh kiện gợi ý từ lịch sử được cấp quyền, chưa đồng bộ danh mục kho ngoài. Xuất/nhận từng phần chưa có; ghi dùng/trả dư vẫn theo dòng.
- Chọn/chụp ảnh tự nén và tải, bỏ nút Tải ảnh lên. Loại ảnh, đơn và người tải được chốt khi chọn; kiểm tra lại quyền trước gửi. Mất phản hồi có nút Thử tải lại ảnh, giữ đúng payload/mã yêu cầu để không trùng file/ảnh. Hàng đợi ảnh chỉ ở bộ nhớ phiên trang, chưa có lưu offline lâu dài.

Kiểm chứng bản này: 35/35 Node, 29 kịch bản HTTP Chromium không page error, 9 kịch bản GAS/document.write/CSP và 71/71 ERP đạt. Browser mô phỏng server đã nhận ảnh nhưng phản hồi bị mất: thử lại cùng key, vẫn chỉ một ảnh. Domain kiểm tra cả phiếu atomic, dòng lỗi không ghi một phần, số DX/PX không trùng và quyền nhận. Kết quả cập nhật trong ba file kiểm thử. Cần UAT thao tác mới trên Google thực tế; không chạy setup lại.


## Điều chỉnh sau UAT 14/10/2026

Người dùng xác nhận đã test hết tiến trình trước bản điều chỉnh này.

- Chốt/đổi hẹn và hẹn lại dùng giờ-only, chọn nhanh sáng/chiều/cả ngày/tùy chỉnh; ngày do máy chủ lấy theo hôm nay tại Việt Nam. Gộp Chốt giờ và Bắt đầu tại khách thành schedule_start atomic: một command/version, một lần đến, replay không tạo visit trùng; giữ kiểm tra quyền, vật tư và xác nhận khách. API schedule/start cũ giữ tương thích. Đây là thao tác dùng khi đến khách; không đánh dấu bắt đầu chỉ vì nhận đơn.
- Ghi dùng/trả hiển thị nhiều món, chọn từng món, nút Dùng hết/Trả hết từng dòng hoặc toàn bộ, lượng thực dùng sửa được. Món không chọn không thay đổi. Có xác nhận lượng, chỉnh lượng hoặc shortcut bỏ tích cũ. Trong nghiệm thu vẫn ghi đủ dòng nhận. Trả vật tư chỉ ghi dư cần trả; kho xác nhận chọn một/nhiều/tất cả món, PN chung trong một command, không tự báo hàng đã về kho.
- Đơn accepted_work rời Bảng điều phối/Việc của tôi và nằm ở tab Đã nghiệm thu; quyền đọc máy chủ giữ nguyên. Kho vẫn thấy đơn cần bàn giao hàng/máy sau nghiệm thu. Hồ sơ tài chính còn chờ đối soát.
- Ghi chú phân công hiện trên thẻ và đầu chi tiết; lần giao lại có tiêu đề và số lần rõ, nội dung được escape. Browser thử giao cùng thợ lần 2, xác nhận ghi chú hiện bên thợ trước và sau mở đơn.

Kiểm chứng local: 38/38 Node, 32 kịch bản HTTP browser không page error, 9 kịch bản GAS/document.write/CSP đạt. Bao gồm giờ theo ngày Việt Nam, schedule/start atomic/replay, không vượt chờ vật tư, chọn dòng/dùng hết/trả hết, hàng không chọn giữ nguyên, dòng lỗi không ghi một phần, batch PN/replay, tab nghiệm thu và ghi chú lần 2. Kết quả cập nhật trong các file kiểm thử. Giữ nguyên project/deployment, public access, tài khoản và dữ liệu; không chạy setup. Cần UAT thao tác mới trên Google.


## Tab chung cho công việc kết thúc

Theo yêu cầu người dùng, đổi tab Đã nghiệm thu thành Đã kết thúc: gom accepted_work và cancelled, bộ lọc Tất cả / Đã nghiệm thu / Đã hủy kèm số lượng, giữ lựa chọn khi refresh trong phiên và reset khi logout. Hai trạng thái rời Bảng điều phối/Việc của tôi; không thay trạng thái dữ liệu và không xóa đơn. Kho vẫn được xử lý bàn giao còn lại. Không làm được còn là việc cần điều phối xử lý, không tự đóng; trạng thái Hoàn thành hồ sơ sau đối soát chưa được triển khai.

Kiểm chứng: 38/38 Node, 33 kịch bản HTTP browser, 9 kịch bản GAS/document.write/CSP đạt. Browser tạo đơn nghiệm thu và đơn hủy, kiểm tra cả hai rời bảng mở, vào tab chung, lọc đúng mỗi nhóm/tất cả và giữ bộ lọc khi tải dữ liệu. Không page error; quyền máy chủ giữ nguyên. Không chạy setup hoặc thay tài khoản/dữ liệu Google.


## Sửa sau phản hồi test v15 (14/10/2026)

Các hướng dẫn gộp hẹn/bắt đầu và hẹn chỉ trong hôm nay ở phần lịch sử phía trên được thay bằng hành vi dưới đây; tab Đã kết thúc và bộ lọc của v16 giữ nguyên.

- Ngày hẹn Hôm nay / Ngày mai / Chọn ngày, mặc định hôm nay theo thời gian máy chủ Việt Nam. Giữ khung sáng/chiều/cả ngày/tùy chỉnh. Domain kiểm ngày tồn tại và không trước hôm nay, cả lịch ISO cũ; giờ đầu/cuối phải đủ và đúng thứ tự. Không đổi lịch đã lưu của đơn cũ.
- Hẹn giờ dùng schedule, chỉ Đã hẹn, không tạo visit. Bắt đầu tại khách một chạm dùng start, có khóa giao diện/replay/version và kiểm vật tư. schedule_start giữ cho trường hợp đến ngay chưa hẹn. Không đánh dấu Đang làm chỉ vì gọi hẹn khách.
- Máy tùy chọn theo đúng khách; bỏ qua vẫn được. Model/serial nhập nhanh tạo máy và đơn atomic, gắn machine_id/snapshot; replay không tạo trùng, lịch sai không lưu máy một phần. Chọn máy cũ bỏ trường tạo mới; hồ sơ cũ và lịch sử liên kết vẫn giữ. Không suy ra máy của đơn cũ chỉ có mô tả.
- Ẩn Phiên bản và vN trong lịch sử với thợ; vẫn giữ expected_version ở dữ liệu để bảo vệ ghi đồng thời.
- SLA tính từ máy chủ khi query: giao thợ khẩn 15 phút, gấp 30 phút, thường 2 giờ từ nhận đơn; thợ nhận 15 phút từ lần giao hiện tại; xác nhận hẹn khẩn 30 phút từ tiếp nhận, thường hết ngày Việt Nam. Hẹn mức gấp dùng hết ngày vì yêu cầu chưa có mức riêng. Lịch requested lúc intake chưa được coi là xác nhận của thợ. Đơn quá hạn ở đầu Bảng điều phối, ghi loại hạn/thời điểm và mở chi tiết được. Đơn nghiệm thu/hủy không cảnh báo. Đây là cảnh báo khi tải/tải lại, chưa có cron hoặc gửi Zalo tự động.
- Báo cáo chỉ điều phối/giám đốc nhận từ máy chủ: nhóm theo ngày tạo đơn Việt Nam và thợ hiện phụ trách, số đơn/nghiệm thu/hủy. Trung bình từ lần nhận hiện tại đến nghiệm thu, hiển thị số mẫu; đơn thiếu mốc không tính. Trễ là đến sau cuối khung hẹn đã có trước lần đến; tính mỗi đơn một lần, chỉ lần đến của thợ hiện tại, không gán trễ của thợ trước khi chuyển. Bộ lọc ngày/thợ trên UI; chưa phải lịch sử phân bổ công từng thợ tham gia.

### Phải xử lý trước pilot

1. ANYONE_ANONYMOUS vẫn cho người ngoài gọi login. Sai 5 lần khóa 15 phút có thể bị dùng để khóa tài khoản thợ; PBKDF2 JS 600.000 vòng còn tiêu tốn quota và thời gian GAS. Staging chấp nhận theo yêu cầu, nhưng cần chống lạm dụng/rate limiting, cơ chế khóa không bị tấn công nhắm tài khoản và đo hash_ms trên GAS trước pilot. Chưa triển khai các biện pháp đó hoặc đổi tham số băm trong lần sửa này.
2. Vật tư còn tên tự do, chưa ánh xạ mã TD của app Kho và chưa trừ tồn. Bước tiếp theo: danh mục mã thống nhất, liên kết giao dịch xuất/nhận/hoàn trả có đối soát/idempotency; không coi sổ bàn giao staging là tồn kho thật.

Kiểm chứng: 43/43 Node; 39 kịch bản HTTP Chromium, 9 kịch bản GAS/document.write/CSP, không page error. Kiểm tra ngày mai/ngày cụ thể/quá khứ/ngày sai và ranh giới ngày Việt Nam, hẹn không tạo visit, start một chạm, chọn máy cũ/tạo nhanh atomic/replay, ẩn kỹ thuật với thợ, SLA/ngày báo cáo/số mẫu/chuyển thợ. Fixture HTTP/GAS cũ đổi từ lịch 13/10 cố định sang giờ hôm nay hợp lệ; không bỏ kiểm tra quyền/recovery. Kết quả cập nhật trong ba file kiểm thử. Chưa thay thế UAT Google cho tính năng mới. Giữ nguyên project/deployment, public access, tài khoản và dữ liệu; không chạy setup.


## Giao diện ưu tiên thợ trên điện thoại (14/10/2026)

Chỉ sửa ui.html/ui.js, kiểm thử trình duyệt và ảnh tài liệu; domain/service/auth/API và quy tắc nghiệp vụ không đổi.

- Header một dòng, bỏ dòng phụ; thông báo thử nghiệm một dòng mảnh. Thợ có tab đáy Việc của tôi / Đã kết thúc / Tài khoản; đăng xuất và tải lại ở Tài khoản. Thành công thành toast tự tắt sau 3 giây, lỗi đỏ giữ lại.
- Thẻ đơn có nút bước tiếp theo dùng command cũ; đơn trễ lên trước, rồi theo giờ hẹn. Nhãn màu dùng chung trên thẻ/chi tiết/bảng. Đủ lịch và vật tư thì Bắt đầu là chính, Đổi hẹn trong Thêm; đến ngay chưa hẹn cũng ở Thêm, không cạnh Hẹn giờ.
- Chi tiết thợ có nút chính lớn cố định trên tab đáy; phụ gộp Thêm. Gọi khách/Chỉ đường thành hai nút >=48px, nội dung >=16px. Bỏ dòng Thanh toán chưa triển khai với thợ; phiên bản tiếp tục ẩn. Hẹn chưa chốt là một dòng ngày ngắn. Lịch sử hiện hai sự kiện mới nhất, phần còn lại thu gọn.
- Điều phối: tab đang chọn tô rõ, nhận đơn là nút + nổi. Desktop >=1000px có bảng lọc trạng thái; đơn trễ đỏ, chi tiết nằm cạnh bên phải. Điện thoại khi mở đơn ẩn danh sách/khung khách khỏi chi tiết; tab Khách/máy vẫn quản lý hồ sơ riêng.
- Giao thợ bằng thẻ chọn một chạm, vẫn gửi technician_id cũ. Hiển thị số việc tiếp nhận hôm nay, đang làm, đang mở và khu vực từ dữ liệu được cấp quyền; ưu tiên cùng khu vực rồi ít việc mở. Không tự điền khu vực thiếu hoặc đổi quy tắc giao việc.

Kiểm chứng: 43/43 Node, 48 kịch bản HTTP browser và 9 kịch bản gói GAS/document.write/CSP đạt, không page error. Luồng chính chạy ở 390px; kiểm tab cố định/active, nút liên hệ/CTA lớn, Thêm và lịch sử thu gọn, font/kích thước, không tràn ngang, bảng desktop, thẻ chọn thợ, thao tác từ thẻ đúng đơn, toast tự tắt và lỗi còn sau 3 giây. Giữ kiểm tra kho, ảnh, chuyển thợ, quyền/replay và ngày hẹn.

Ảnh trước/sau tại docs/ui-review-20261014/README.md: danh sách và chi tiết 390×844, bảng điều phối 1440×1000, dùng fixture riêng. Đã nhìn kiểm tra ảnh sau; ảnh trước lấy từ a4b9e8f. Không dùng dữ liệu khách thật. Script ui-screenshots.cjs chụp lại bản hiện tại. Cần UAT trên điện thoại/GAS thực tế; không chạy setup, không đổi tài khoản hay dữ liệu.

Rà soát cuối: small/order code và chữ phụ cũng tối thiểu 16px, bổ sung kiểm tra computed font của nội dung/nút/nhãn/summary; 48 kịch bản vẫn đạt. Cập nhật lại ảnh sau với cỡ chữ cuối cùng.


## Đồng bộ khi nhiều màn hình cùng mở

- Counter dùng revision repository, công bố CacheService + Script Properties dưới khóa ghi; command/upload mới tăng, replay không tăng. changes kiểm phiên rồi đọc metadata, không mở Sheets/Drive/snapshot. Pending marker trước ghi, phục hồi/publish khi query hoặc ghi sau giúp không mất thông báo lúc ghi gián đoạn. Không đổi nghiệp vụ, dữ liệu tài khoản hay định dạng journal dùng chung ERP.
- Poll 20 giây khi hiển thị; focus/visibilitychange kiểm ngay, hidden dừng timer. Phiên bản khác thì query. Không query/vẽ lại khi form/ảnh đang xử lý hoặc ảnh chờ retry; giữ draft, hiện dải và thông báo trong dialog. Áp dụng cập nhật giữ selected và scroll; không giữ chi tiết nếu mất quyền đọc. Tránh response cũ ghi đè phiên mới và response đến sau logout.
- Highlight 6 giây cho đơn mới/đổi, toast giao mới/giao lại cho thợ, tiêu đề đếm đơn chưa xem; mở/thao tác đơn xác nhận đã xem. Backoff 20/40/80/120 giây, không spam lỗi; AUTH_REQUIRED đóng form và về login.
- Tắt màn hình/ẩn app không polling. Gửi Zalo OA/Telegram khi app không mở để bước sau; chưa có thông báo đẩy.

Kiểm chứng: 44/44 Node, 48 kịch bản UI cũ, 9 kịch bản GAS UI và 9 kịch bản hai phiên live đạt. Local dùng timer 20 giây thật: giao đơn 20.116s, bắt đầu 20.389s, nghiệm thu 19.905s, đều dưới 25s. Form đang nhập còn nguyên, giữ lựa chọn/cuộn; clock/visibility mô phỏng kiểm backoff/hidden/wake/expired. Không page error. GAS VM đặt openById ném lỗi vẫn changes và benchmark chạy được, kiểm replay/cache fallback và xóa tài nguyên benchmark. Các số local/VM không phải số đo Google thật.

benchmarkDispatchChanges có public owner guard và 5 mẫu thời gian xử lý GAS, không mở Sheets/đọc mật khẩu. Không có OAuth clasp cục bộ; workflow sẽ thử Execution API bằng quyền Google sẵn có và ghi artifact kết quả/chặn. Nếu chưa đo được, chủ project có thể Run helper trong editor. Cần UAT độ trễ GAS/trình duyệt điện thoại thực tế; mốc dưới 25s ở đây là kiểm thử local, không cam kết khi mạng/GAS chậm.
