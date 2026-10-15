# Thiết kế điện thoại cho thợ — 15/10/2026

Nguồn: README.md và design/ trong gói thiết kế người dùng gửi ngày 15/10/2026. Prototype chỉ được mở trên web server tĩnh để tham khảo và bấm thử; React/Babel của prototype không được đưa vào app. Source hiện tại là `ui.html.txt` (index.html) và `ui.js.txt` (app.js); build GAS vẫn dùng loader hiện có.

## Bước (a) — token và khung chung

Chỉ hiển thị khi `body.is-tech` và viewport ≤750px. Giữ nguyên giao diện desktop và các vai trò điều phối/kho/kế toán/giám đốc. Token màu/kích thước trong một media query, font Be Vietnam Pro tải khi mở màn thợ mobile, fallback system-ui. Chữ tối thiểu 16px; CTA 62px; tab 64px; nội dung có container cuộn block bên trong khung flex để thẻ không co.

- Thanh trên: tiêu đề 22px, quay lại, đường vào Tài khoản, trạng thái mạng và thời gian query thành công gần nhất. Chip ảnh đọc queue hiện có, đếm cả ảnh đang tải/lỗi; không bịa phần trăm khi transport chưa có progress thực.
- Dải DỮ LIỆU THỬ chỉ hiện khi body khai báo environment=staging; các build hiện tại đều là staging. Không thay notice của vai trò khác.
- Hai tab gốc Việc của tôi / Tiền tôi giữ, số liệu từ projection đã cấp quyền. Trang con ẩn tab; Đã kết thúc / Đã đóng và Đăng xuất vẫn vào được qua Tài khoản.
- Thanh đáy tái sử dụng nút `.detail-cta` hoặc nút lập NQ gốc bằng di chuyển DOM, không clone nút/không thêm command. Khi quay về desktop trả nút về chỗ cũ. Giữ nextAction/photosReady và handler gốc. Dialog mở thì thanh CTA nền ẩn.
- Thành công tự tắt sau 2,4 giây riêng thợ mobile. Lỗi giữ lại theo hành vi app, không đổi thành toast tự mất. Khôi phục vị trí cuộn bên trong main khi query tự làm mới; polling/backoff/protected forms không đổi.

Các hàm app.js đã chỉnh: `message`, `refresh` (thời điểm hiển thị/vị trí cuộn), `resetLogin`, `render`, `account`, `patchPhotos` (cập nhật chip). Thêm `techMobile`, `updateTechHeader`, `updateTechCashAction`, `renderTechShell`; listener giao diện cho back, connectivity và viewport/dialog. Không đổi API, server, domain, xác thực, payload hay queue gửi ảnh.

## Bước (b) — Việc của tôi

Theo gói `dieu-phoi-desing.zip` mới, README mobile không đổi; gói bổ sung README_DESKTOP và prototype Desktop App. Hoàn tất (b) trước khi chuyển (c), rồi làm desktop theo thứ tự (i)–(p).

- Nhóm Hôm nay (gồm việc cũ chưa kết thúc để không mất đơn), Sắp tới, Chờ linh kiện; mỗi đơn chỉ xuất hiện một nhóm. Ngày hẹn lấy từ appointment hiện có/service_date theo giờ Việt Nam. Đơn của thợ khác và đơn đã kết thúc không xuất hiện trong danh sách này.
- Thẻ nguyên khối bấm mở chi tiết: mã TD, ưu tiên, trạng thái, tên khách 19px, địa chỉ, giờ/ngày hẹn hoặc linh kiện chờ, nhãn Có giao hàng, ghi chú giao lại mới nhất. Giữ trạng thái tiền khi đã có billing; không thêm nhãn chưa chốt tiền vào thẻ đơn chưa định giá. Viền trái 7px theo trạng thái, quá hạn dùng đỏ và mô tả SLA đúng loại, không gọi mọi SLA là trễ hẹn.
- CTA 62px mở việc ưu tiên: quá hạn → Khẩn/Gấp/Thường → giờ hẹn. Chỉ mở chi tiết, không tự gửi accept/start. Với mã TD thật dài, nhãn CTA tách hai dòng 19px/16px để vừa 62px. Chuyển giao sang thợ khác thì query tiếp theo bỏ thẻ và cập nhật đích CTA.
- Trống hiển thị thông báo và đường sang tiền giữ; vẫn ghi polling thực 20 giây, không hứa lưu offline. Desktop >750px và các vai trò khác vẫn dùng board cũ trong mốc này.

Hàm sửa: `board` (nhánh mobile mine), `renderTechShell` (CTA). Thêm `techOpenOrders`, `techOverdue`, `techOrderSort`, `techDelayText`, `techOrderDay`, `techOrderTime`, `techOrderCard`, `techBoard`; click mở ưu tiên đi cùng handler mở đơn hiện có. Không sửa nextAction, API, quyền, deadline domain hoặc dữ liệu. Test UI cũ chỉ đổi thao tác vào thẻ theo thiết kế, vẫn kiểm nhận đơn bằng command gốc ở chi tiết.

## Bước (c) — Chi tiết đơn và bảng hẹn giờ

- `detail` vẫn xây danh sách `buttons` theo điều kiện và quyền gốc, rồi chỉ nhánh `techMobile()` dùng `techDetail`. Các thẻ: đầu đơn/tên khách 23px, liên hệ hai hàng với nút 118×56px, lịch/máy/yêu cầu, ghi chú giao lại, PX giao kèm, tiến trình, Thao tác khác đóng mặc định. Mỗi hành động phụ được giữ lại, bỏ màu primary để tránh cạnh tranh CTA 62px. Hành động chính tiếp tục dùng `nextAction` và `photosReady`.
- `techProgress` đọc `data.events` của đơn; nhận/hẹn/bắt đầu lấy sự kiện từ lần phân công gần nhất, không dùng dữ liệu giả `o.events` và không suy đoán thợ mới đã nhận từ lần cũ. Lấy đủ PX chỉ đánh dấu sau khi mọi PX còn hiệu lực đã picked. Đơn hủy/đóng không có bước kế tiếp. Đây là hiển thị sự kiện, không điều khiển/chặn workflow.
- `detailRecords` tách nguyên markup vật tư, khoản thu, đồng bộ, form tải ảnh, queue/gallery riêng tư và lịch sử của chi tiết cũ để dùng chung. Desktop/vai trò khác giữ cấu trúc cũ. Ảnh vẫn patch tại chỗ; lịch sử giữ hai dòng gần nhất và mở rộng.
- `enhanceTechSchedule` chỉ đổi form hẹn của thợ mobile thành bottom sheet, ngày ba nút, giờ 2×2, ngày/giờ tùy chọn, checkbox 32px và lưu 62px. Chip chọn cập nhật chính các trường `day_choice`, `appointment_date`, `time_window`, `time_start`, `time_end` gốc qua change handler; không tạo payload/API khác. Có lịch thì chọn sẵn đúng khung hoặc giờ tùy chỉnh. Giữ yêu cầu lý do khi đổi lịch đã xác nhận; ghi chú lần hẹn đầu không bắt buộc. Chạm nền hoặc Đóng vẫn đi theo handler đóng gốc; form mở vẫn chặn redraw do polling.
- `updateTechSchedule` khóa nút cho đến khi xác nhận đã gọi khách và có giờ. `schedule` chỉ lưu lịch; `schedule_start` và `resume_schedule` giữ tên lệnh, điều kiện và ý nghĩa riêng. Không gộp hẹn với bắt đầu. Không đổi business/auth/server/API, không ghi Kho/Finance/AI thật.

Hàm app.js sửa: `detail`, `openForm` (gọi skin sau khi điền form), `submitForm` (cập nhật lại trạng thái nút sau lỗi). Thêm `techDetail`, `techDeliverySummary`, `techProgress`, `detailRecords`, `enhanceTechSchedule`, `updateTechSchedule` và listener chip/backdrop giao diện. CSS chỉ trong `body.is-tech` + media ≤750px. Bộ test trình duyệt mới `technician-detail-browser.cjs`; test nghiệp vụ cũ đổi selector/chọn chip thay select ẩn, không bỏ kiểm chứng nghiệp vụ.

## Bước (d) — Lấy hàng giao kèm

- `updatePickupFields` giữ nhánh cũ nguyên vẹn cho desktop; riêng thợ ≤750px dùng `techPickupRows`. `enhanceTechPickup` bố trí chính form `pickup_delivery` thành màn đầy đủ: thanh quay lại/tiêu đề, vùng nội dung cuộn, CTA 62px cố định trong form. Không clone nút submit/đóng, không thêm command. Dialog vẫn bảo vệ form khỏi polling; dải cập nhật nền có vùng riêng, không đẩy CTA khỏi màn hình.
- Đầu phiếu lấy số PX, kho 58/145, thời gian soạn, mã đơn và khách từ projection thật. Chỉ một PX thì ẩn select nhưng vẫn gửi issue_id gốc; nhiều PX giữ chọn phiếu. Kho chưa báo soạn hiện đúng trạng thái, không tự suy ra đã soạn. Mã TD/unit chưa có không tự bịa, ghi Chưa gán mã TD/đơn vị.
- Nút Đã lấy đủ tất cả đặt trên danh sách; mỗi món có checkbox 36px, tên 18px, mã 16px, stepper 48px và số 21px. Ban đầu riêng mobile chưa tích/qty 0 để thợ chủ động đánh dấu; desktop giữ mặc định cũ. All chỉ điền số, không tự xác nhận đã kiểm hàng. Đổi số, chọn/bỏ món, đổi PX hoặc sửa serial thì yêu cầu đánh dấu lại pickup_confirmation.
- Serial máy giữ gõ/chọn datalist, thêm nút xác nhận đã kiểm đúng serial trên PX để điền nhanh có chủ đích; không tự điền/đoán lúc mở form. Server vẫn chặn serial sai. Dòng lấy đủ từ trước khóa ở qty 0 của lần lấy này, gửi đủ request_id theo API hiện tại; chỉ phần còn thiếu được lấy thêm.
- Khác điểm mẫu cần giữ nghiệp vụ: **vẫn cho ghi nhận lấy một phần**, không khóa đến khi mọi món đều tích. Có qty >0 hợp lệ và checkbox xác nhận thì cho gửi; phần chưa lấy vẫn pending và chưa bắt đầu được. CTA nói rõ lấy một phần; cảnh báo chỉ nói phần thiếu còn chờ lấy, không hứa gửi thông báo kho chưa có. Không đổi serialize `pickups`, expected_version, key, API/domain/auth/tồn kho.

Hàm sửa: `openForm` (reset modal skin và gọi bố cục), `updatePickupFields` (nhánh mobile), `submitForm` (cập nhật trạng thái nút sau lỗi). Thêm `techPickupRows`, `enhanceTechPickup`, `updateTechPickup` và listener stepper/serial/giao diện. CSS chỉ body.is-tech ≤750px; nút primary bật trong dialog thợ dùng chữ trắng để đủ tương phản, nút khóa giữ màu disabled. `technician-pickup-browser.cjs` kiểm lấy đủ/thiếu, giới hạn qty, consent/serial, nhiều PX, mất phản hồi sau commit/replay đúng một lần, polling giữ form, 320px và desktop 751px. Test delivery cũ chỉ thêm đánh dấu lại sau khi đổi số/serial, giữ kiểm serial sai/lấy thiếu/lấy đủ và start.

## Bước (e) — Nghiệm thu

- `enhanceTechComplete` bố trí form `complete` gốc thành màn toàn chiều cao cho thợ ≤750px: header/back, nội dung cuộn, CTA 62px ở đáy; không clone submit/đóng. Hai ảnh ở đầu, chip kết quả nhiều lựa chọn, hàng giao/vật tư, dòng công/vật tư tính tiền, tổng, hai thẻ xác nhận và ghi chú thu gọn. Font ≥16px, preview ảnh 116px, số tiền 21px và tổng 26px.
- `customer_accepted` (khách nghiệm thu), `customer_agreed` (đồng ý giá), `usage_confirmed` (số lượng) là ba điều kiện riêng. Không gộp theo nhãn sai trong prototype. Mọi checkbox ban đầu giữ trạng thái gốc, không tự đánh dấu. Vẫn hỗ trợ nhiều dòng labor/material, thêm/xóa dòng, khoản 0đ có free=true; không tự đặt giá/tên hay ngầm biến trống thành 0.
- `techChargeValue`/`formatTechCharge` chỉ là adapter hiển thị cho ô tiền trong form complete mobile: text định dạng Việt Nam 1.250.000, command nhận integer 1250000. Desktop/form khác giữ input number và Number() gốc. Giá trống/chữ/ký hiệu không hợp lệ không có tổng hợp lệ; tổng không vượt safe integer. Preview tiền hàng theo số thực giao và đơn giá PX, mang về không tính; phần đã ghi sử dụng/giao trước vẫn được tính từ dữ liệu đơn. Server vẫn chốt billing/duyệt giá, giao diện không thay thế các kiểm tra này.
- Stepper dùng chính `[data-usage-id]`/name/max/min gốc, hiển thị Giao khách hoặc Đã dùng và phần Mang về/Trả kho; đổi số bỏ xác nhận cũ. Các nút dùng/trả hết giữ trong Chọn nhanh tất cả; bỏ nút riêng từng món theo mẫu, không bỏ xác nhận kho/PN. Vật tư tiêu hao không tự thành hàng bán hay tự thêm tiền.
- `patchTechCompletePhotos` lấy ảnh đúng actor/visit, thumbnail từ cache/API riêng tư hiện có. Chụp lại dùng chính `selectPhoto` + queue nén/upload/retry/idempotency cũ, chỉ thêm đầu vào kind từ `data-complete-photo`; không đổi transport/service/API hoặc chia sẻ Drive công khai. Hiển thị tiến trình không xác định khi tải vì google.script.run chưa có % thực; không bịa 64%. Lỗi/thử lại luôn khóa hoàn tất, retry không ghi trùng, expected_version được cập nhật theo projection upload như cũ, không query toàn bộ hay vẽ lại form.
- Giữ cửa vào nghiệm thu theo `photosReady`: tải ảnh lần đầu từ chi tiết đơn; khi đủ ảnh mới mở form, bên trong có thể chụp lại. Giữ luồng sau thành công: quay về đơn đã nghiệm thu với CTA Thu tiền nếu thu ngay còn phải thu; không tự mở form khác/không tự tạo PT. Khách công nợ và miễn phí không có nút thu sai. Những điểm này theo hành vi app đã thống nhất, không đổi workflow để khớp dữ liệu mẫu.
- Nút chỉ bật khi đủ ảnh, việc, lượng, giá/tên/miễn phí và các xác nhận; lỗi server ở footer giữ nội dung/key. Polling giữ form. Ngưỡng duyệt giá vẫn do server quyết định: sai thì toàn bộ nghiệm thu/vật tư không ghi; retry giữ key và snapshot đúng.

Hàm sửa: `openForm` (reset skin/call), `moneyPayload` (đọc giá qua adapter), `submitForm` (cập nhật trạng thái sau lỗi), `patchPhotos` (patch ô ảnh/CTA), `selectPhoto` (đầu vào kind cho ô ảnh). Thêm `techChargeValue`, `formatTechCharge`, `enhanceTechChargeRows`, `enhanceTechComplete`, `patchTechCompletePhotos`, `updateTechComplete` và listener giao diện. CSS chỉ body.is-tech ≤750px. Test cũ chỉ đổi nút lượng sang stepper và kiểm nút disabled thay bấm khi còn thiếu xác nhận; giữ mọi assertion nghiệp vụ. `technician-complete-browser.cjs` kiểm 10 nhóm kịch bản gồm snapshot tiền, miễn phí/công nợ, replay, chụp lại/lỗi mạng, duyệt giá, giữ form và viewport.

## Bước (f) — Thu tiền

- `enhanceTechPayment` bố trí form `report_payment` gốc thành màn toàn chiều cao: tổng tiền nền navy, lịch sử khoản thu thu gọn, ô tiền 56px, thẻ hình thức 60px và CTA 62px cố định. Chỉ áp dụng thợ ≤750px. Dùng danh mục đang hoạt động, không hard-code hình thức; desktop và vai trò khác giữ form cũ.
- Tiền ban đầu **để trống**. Thu đủ chỉ điền số còn được báo thu khi thợ chủ động bấm. `techChargeValue`/`formatTechCharge` định dạng Việt Nam nhưng payload amount vẫn là integer; giữ nguyên method_id/account_id, expected_version và idempotency key. Không đổi command, quyền, API hoặc quy tắc thu tiền.
- Phân biệt tổng đơn, đã báo, đã xác nhận, chờ đối soát và **còn được báo thu** (collectable). Khoản chờ đã giữ chỗ thì không thu thêm; báo đủ nhưng chờ đối soát dùng màu cảnh báo, không báo Đã thanh toán. Tiền mặt chưa nộp ghi Tiền thợ giữ, không gọi là tiền về quỹ. Lịch sử giữ lý do từ chối; ảnh biên lai tùy chọn vẫn tải ở chi tiết qua luồng cũ.
- Chọn chuyển khoản tự hiện đúng tài khoản cố định của hình thức, số/chủ tài khoản và nguyên mã TD làm nội dung. Không có ô chọn tài khoản riêng, không đoán mapping/fallback. Cấu hình chưa đủ thì khóa gửi; server tiếp tục kiểm tra độc lập. Nút sao chép giữ số 0 đầu/mã có gạch; clipboard không khả dụng thì hướng dẫn nhấn giữ. QR chưa triển khai.
- Khách công nợ, miễn phí, đơn chưa nghiệm thu/đóng/không thuộc thợ và thu vượt không gửi được. Sau thành công giữ hành vi đóng form/quay lại đơn: thu một phần có thể mở lại, đã báo đủ chờ kế toán thì không có CTA thu thêm. Polling không mất nội dung. Lỗi giữ form/key; mất phản hồi sau commit rồi thử lại không tạo PT thứ hai.

Hàm sửa: `paymentList`, `bankDetails`, `openForm`, `moneyPayload`, `submitForm`, phần tiền trong `techDetail`. Thêm `techPaymentHistory`, `techPaymentOverview`, `techPaymentDone`, `enhanceTechPayment`, `updateTechPayment` và listener radio/bàn phím/ô tiền/sao chép. CSS nằm trong body.is-tech + media ≤750px. `technician-payment-browser.cjs` có 11 nhóm kịch bản; money-browser cũ cập nhật selector/định dạng, giữ kiểm thu vượt trực tiếp qua API. Code.gs backend byte-identical bước (e).

## Phần desktop mới — kế hoạch theo README_DESKTOP

Áp dụng ≥1000px, không phải thợ; 751–999px giữ giao diện hiện tại. Đây là phạm vi đã ghi nhận, chưa triển khai trong (b):

- (i) `render` và khung HTML/CSS: menu trái 240px, thanh trên 68px, chỉ hiện mục theo quyền thực, không thêm bộ chọn vai trò của prototype vào app.
- (j) `board`, `coordinatorTable`, `detail`, `technicianPicker`, `openForm`: bảng điều phối, panel 470px, giao thợ và drawer nhận đơn.
- (k) `board`: bảng kết thúc/đóng và bộ lọc.
- (l) `preparationBoard`, `materialPanel`, các bảng kho: soạn/bàn giao theo điều kiện lệnh hiện có.
- (m) `funds`, `depositCards`: quỹ và đối soát.
- (n) `reports`, `moneyReports`: các bảng báo cáo.
- (o) `syncBoard`, `financeMapping`, `paymentMethods`, `customers`: các màn quản trị, giữ cấu hình ngân hàng gộp của v38, không quay lại hai nơi theo hình mẫu cũ.
- (p) HTML đăng nhập, giữ xác thực hiện có.

## Các bước mobile còn lại — (g) đến (h)

(g) `myCash`, `depositCards`: thẻ tiền giữ và phiếu NQ; giữ nguyên xác nhận số thực nhận.

(h) các màn trống/mất mạng: chỉ mô tả đúng khả năng app hiện có.

## Điểm mẫu khác nghiệp vụ — giữ hành vi app

- Polling hiện 20 giây và dừng khi ẩn; không đổi sang 30 giây theo chữ mẫu.
- App chưa có queue offline bền vững cho các command. Không hứa “đã lưu trên máy, tự gửi” cho thao tác ghi; ảnh queue hiện tại giữ nguyên, không thêm persistence.
- Tiền báo thu ban đầu để trống, thợ chủ động bấm Thu đủ; không mặc định thu hết. Danh mục tiền không được hard-code chỉ ba dòng mẫu, dùng các hình thức đang hoạt động.
- Nội dung chuyển khoản vẫn là mã đơn theo server; không đổi thành mã bỏ gạch + THANH TOAN.
- `customer_accepted` và `customer_agreed` là hai xác nhận khác nhau. Không gộp sai chỉ vì nhãn mẫu. Vẫn hỗ trợ nhiều dòng công/vật tư tính tiền và miễn phí có xác nhận.
- Phiếu nộp quỹ dùng NQ, không đổi thành PN theo dữ liệu giả của prototype (PN dành nghiệp vụ nhận kho).
- Lỗi vẫn giữ trên màn hình. Không đổi các quy tắc này trong công việc chỉ làm bố cục/CSS.

## Kiểm tra

`ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/technician-shell-browser.cjs` kiểm 390px, mép 750/751px, CTA/tab, số liệu thật từ fixture domain, giữ cuộn, tránh trùng command, form NQ, các đường vào lịch sử, chip queue/lỗi, chặn nghiệm thu khi ảnh chưa lưu và bốn vai trò khác. `DISPATCH_TECH_SCREENSHOTS=<thư mục ngoài checkout>` xuất ảnh 390px. Browser test nghiệp vụ chỉ cập nhật đường đi menu/selectors theo layout; không bỏ kiểm nghiệp vụ.
