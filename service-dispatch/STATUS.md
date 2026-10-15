# Điều phối dịch vụ – trạng thái ngày 13/10/2026

## 15/10/2026 — người dùng báo đã hoàn tất cài hai consumer

- Người dùng xác nhận đã làm setupCopyConsumer/chuyển khóa/enableCopyConsumer. Đây là xác nhận từ người dùng; chưa có kết quả ghi sổ UAT được đối chiếu.
- Đã thử đọc metadata tiến trình bằng OAuth có sẵn, chỉ tên hàm/trạng thái/thời gian, không đọc secrets/sheet/log nội dung. Google trả 403 PERMISSION_DENIED cho cả Điều phối/Kho-copy/Finance-copy. Không suy thành consumer lỗi hoặc thiếu quyền ghi sheet; cũng không coi consumer/trigger đã được tự động xác minh. Kết quả: docs/integration-20261015/runtime-audit-after-owner.json.
- Bước kế: owner cài installDispatchOutboxPump với director ID hợp lệ; giám đốc gán các ID Finance hiện hữu, rồi dùng UAT_FIRST_ORDER.md trên copies và đối chiếu ledger/số dư/số phiếu. Chưa bật đồng bộ thật hoặc deploy app thật.


## 15/10/2026 — đã tạo hai consumer Google riêng cho 4 copy ID được cung cấp

- Warehouse project `1gU8n4jcCf52xqZyVzpP13Ba-M5B5Dko0c3qH12VWMOZnxz5xsIROseXn`; Finance project `1FuBiv-e2UbP-FjLaNoh56XX8BEllZWIX7lbiee_dejmqAVFgzF8uAuqf`. Source đã push, chưa deploy web app/cài trigger/chuyển token-HMAC/bật consumer. Đúng 4 ID trong ops/integration-copy-20261015.request.json; thay ID qua Properties khác pin bị chặn. Finance consumer không chuyển ảnh biên lai, ảnh giữ ở Điều phối; không cần thêm ID folder Finance để khởi động.
- Dùng CLASPRC_JSON đang có qua GitHub Actions; clone Kho/Finance chỉ để đọc code native riêng tư, kiểm native 98/98 + 10 luồng trên fixture trước khi tạo. Không push original projects, không đọc/ghi sheet thật trong workflow. Không đăng source Finance private/native packages/secrets vào GitHub artifacts/logs; artifact chỉ registry ID.
- Installer setupCopyConsumer điền ID metadata, giữ tắt và báo tên thuộc tính thiếu; owner chép riêng hai khóa từ Điều phối qua Google Settings. enableCopyConsumer chỉ cài trigger 5 phút sau marker + quyền native; không tự gán ADMIN/OPERATOR. Bootstrap và provisioning được kiểm bằng fixture: pin/secret/marker/quyền, trigger một lần, lưu registry trước push, khôi phục manifest, retry lỗi không tạo project trùng, chặn push legacy.
- **Chưa UAT trên các sheet Google copy**, chưa biết runtime principal có quyền ghi sổ, chưa có trigger thực hoặc nối vận hành. Owner cần hoàn tất [OWNER_SETUP.md](docs/integration-20261015/OWNER_SETUP.md), sau đó thử chứng từ/các chặn/ledger/số dư thực tế trên copy. Apps Kho/Finance/AI thật chưa thay đổi; AI vẫn chờ duyệt riêng.


## 14/10/2026 — nối Kho/Finance theo outbox (chưa bật trên Google)

- Điều phối chỉ ghi hàng chờ riêng. QL_KHO là đầu ghi duy nhất cho 58/145, native INVENTORY_IN/OUT → ledger/sequence/validation; Finance ghi native THU/CHUYEN_QUY/CONG_NO_KH. Bản sao có copy marker, từ chối ID file thật; envelope/result ký HMAC, dedupe durable trong lock. Trigger consumer và pump 5 phút có installer owner-only; bảng Đồng bộ nhận kết quả/manual retry/lý do/số phiếu, điều kiện đóng kiểm job recorded hoặc giám đốc duyệt ngoại lệ.
- Catalogue mã TD đúng cột hai kho, readonly/cache 180 giây; outside-catalog giữ lại để kho gán; lượng vượt tồn chỉ cảnh báo. OUT theo actual pickup, IN theo actual PN/NK, không tạo OUT khi tạo PX/soạn. Không fuzzy-match/tạo SKU mới.
- Mặc định hiện tại: Tiền mặt, Chuyển khoản ACB, Chuyển khoản TCB. VCB ngừng dùng, lịch sử cũ giữ nguyên. Giám đốc chọn ID tài khoản/danh mục/khách/nhân viên từ Finance, không tạo tài khoản. Cash → TAM_GIU hiện hữu; NQ → Quỹ TIEN_MAT theo phần thực nhận; bank confirmed → bank đã chọn; goods/service phân bổ theo billing. Thiếu mapping không ghi và không dùng tài khoản mặc định; retry cùng key; snapshot mapping đã gán không đổi theo cấu hình mới.
- Hồ sơ công nợ đóng hai bước: đề nghị đóng phát hành nợ → chờ Finance ghi → đóng cuối. Không backfill lịch sử. Sau có job Finance, điều chỉnh giá bị chặn tới khi có luồng điều chỉnh xuyên app. Tạm dừng không bỏ nghĩa vụ của đơn đang đồng bộ.
- **Kho/Finance/AI_KHO thật không sửa/push/deploy.** Audit AI_KHO đã liệt kê cả IN/OUT AI và thủ công, giá/schema/reset, reversal/pending/dayclose/rollback, alias/log. Review patch chuyển IN/OUT qua QL_KHO; mọi setter Kho bị chặn kể cả nested range/parent. Các chức năng chưa có adapter bị chặn, cần chủ duyệt. Bản AI đang chạy vẫn có đường ghi cũ cho tới khi được duyệt/chuyển triển khai.
- **Finance cần duyệt riêng:** isDateClosed_ của source hiện tại trả false. Consumer bản sao khôi phục kiểm CHOT_SO, không tự đổi ngày. THU hỗn hợp dùng hai dòng native; NQ nhiều nguồn có dòng chuyển theo allocation, external key từng dòng chống trùng sau lỗi giữa chừng. Kho ledger pending/reconciliation bị chặn, không ghi lần hai.

**Kiểm chứng:** 108/108 Node (84 cũ + 14 domain integration + 10 transport/privacy/cache); integration-browser 10, money 11, delivery 9, GAS iframe 9; hồi quy UI/hồ sơ máy/ảnh/live chạy lại. Native QL_KHO runRegressionTestsV109 98/98 và 10 luồng native Kho/Finance; AI review 8 nhóm đạt. Native là fake workbook đúng schema + code native từ checkout QL_KHO bb25855 / Finance d3c4607 / AI d77e5be, **không phải UAT trên bản sao Google**. Kết quả/provenance: docs/integration-20261014/. Không có số đo thời gian/quota consumer GAS thực tế trong lượt này.

**Còn chờ trước nối vận hành:** chủ chạy setupDispatchIntegrationCopies, tạo consumer project riêng/khai báo quyền và ID/token/HMAC an toàn, gán các ID Finance hiện hữu, chạy UAT trên bản sao Google và đối chiếu ledger/số dư. Sync mặc định tắt; chỉ bật copies sau cấu hình. Cần anh Tuấn duyệt riêng trước cutover QL_KHO/Finance thật hoặc triển khai AI_KHO. Không push main các repo tự deploy. Snapshot toàn bộ, native partial-write reconciliation, bảo vệ login/quota, hoàn tiền/điều chỉnh giá và công nợ theo kỳ vẫn là mốc trước pilot.

Hướng dẫn chi tiết và audit: [integration-20261014/README.md](docs/integration-20261014/README.md), [AI_KHO_145_REVIEW.md](docs/integration-20261014/AI_KHO_145_REVIEW.md).


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

Workflow đầu đã thử đo GAS bằng Execution API: Google trả USER_ERROR/code 3, reading from storage, NOT_FOUND; không có mẫu thời gian GAS. Bổ sung thử context deployed (--nondev) bên cạnh devMode, không sửa quyền/API deployment. Nếu cả hai vẫn không trả đo, Run benchmarkDispatchChanges trong editor bằng tài khoản chủ project là bước còn lại.

Kết quả thử cả devMode và deployed context: cả hai trả Google USER_ERROR/code 3, reading from storage, NOT_FOUND. Chưa có số đo GAS; kết quả lưu artifact changes-benchmark-status.json. Chủ project Run benchmarkDispatchChanges trong editor để lấy samples_ms/average_ms. Tạo/xóa phiên benchmark dùng cùng ScriptLock với auth, tránh ghi đè dọn dẹp khi người khác đăng nhập; phần đo changes không giữ khóa.

CI phát hiện race ở harness clock.pauseAt dùng thời gian Node, có thể lùi vài ms so với browser. Đổi mốc pause lấy trực tiếp Date.now của browser +10 giây; không đổi timer sản phẩm hoặc nới ngưỡng 25 giây. Các bước real-timer chạy trước đó vẫn giữ nguyên.

## Tối ưu ảnh nghiệm thu

- JPEG cạnh dài 1280, chất lượng bắt đầu 0.7, giảm dần nếu cần đến dưới 200000 B. Thumbnail cạnh dài 320, tối đa 30000 B, gửi kèm và lưu thêm file Drive private. Giữ tương thích evidence cũ không có thumbnail: hiện nút, chỉ tải đầy đủ khi bấm; không backfill hoặc đổi quyền file cũ.
- Upload đọc auth/directory một lần; dùng chung một snapshot preflight cho quyền/idempotency. Transaction vẫn đọc lại current dưới ScriptLock và kiểm version/quyền. Hook onCommitted lấy projection đơn từ state vừa commit/replay, không persist projection lớn trong receipt, không snapshot/query lại sau ghi. GAS publisher lấy revision đã commit, bỏ recoverLocked riêng.
- Upload trả order/events/timings; UI cập nhật riêng dữ liệu đơn và gallery. Không query/refresh toàn bộ sau ảnh, không dựng lại form chọn ảnh hay form đang nhập. Form của chính thợ chỉ nâng version khi thao tác duy nhất vừa commit là ảnh của phiên này; thay đổi nghiệp vụ đồng thời vẫn bị kiểm version. Polling 20s hoạt động riêng và trì hoãn khi có form/ảnh đang tải/chờ retry.
- Chọn nhiều ảnh/chụp tiếp không khóa toàn màn hình; queue tuần tự, preview và nhãn Đang tải / Đã lưu / Lỗi - thử lại. Retry giữ nguyên key/payload/version, race cùng key ở transaction cũng replay và dọn file chưa sở hữu. Nghiệm thu chỉ bật khi hai loại ảnh của lần thực hiện hiện tại đã lưu và queue của đơn không còn ảnh chưa xác nhận. Ghi thao tác công việc cùng đơn chờ queue kết thúc; vẫn có thể mở và nhập form. Queue chỉ ở bộ nhớ trang: không đóng/tải lại trước khi Đã lưu, chưa có offline queue bền vững.
- Xem thumbnail/full đều xác thực và kiểm quyền đơn, không chia sẻ công khai Drive. Cleanup kiểm cả hai file trong state/journal; giữ file khi phục hồi chưa chắc chắn. Response cũ sau logout/đổi đơn không đưa ảnh vào phiên mới.
- Kiểm chứng local: 47/47 Node; ERP 71/71; 48 kịch bản UI; 9 GAS iframe; 9 live hai phiên; photo browser kiểm 4000×3000 <200KB, 3 ảnh + mất phản hồi/retry = đúng 3 evidence/6 file, draft giữ nguyên, 0 query sau upload, thumbnail trước/full khi bấm. GAS VM bridge kiểm 1 auth Properties read + 2 recoveries, counter đúng/replay không tăng; số đo này không phải Google thật.
- Số đo local và giới hạn: [báo cáo trước/sau](docs/photo-performance-20261014/README.md). Payload chính 367449 → 132820 B, thumbnail thêm 27244 B; query sau ảnh 1 → 0. Chưa có timings Google trước/sau do Execution API NOT_FOUND; Console/GAS log đã có instrumentation để UAT. Không cam kết thời gian điện thoại hoặc GAS dựa trên local.

### Bắt buộc trước pilot: thay persistence snapshot

Toàn bộ orders/events/commands và journal/state vẫn trong snapshot; domain clone và transaction đọc/ghi/chứng thực chunks sẽ chậm khi số đơn/journal tăng, còn giới hạn dung lượng/rows staging. Cần normalized tables theo orders, evidence, events, idempotency receipts và material movements; đọc/ghi theo đơn, index, retention/archive, migration/backup/recovery có kiểm thử. Tối ưu upload hiện tại không thay thế bước này. Cùng mốc còn phải xử lý lạm dụng login/quota của ANYONE_ANONYMOUS và nối vật tư theo mã TD của app Kho trước khi trừ tồn thật.

## Từ ngữ giao diện

Đổi nhãn nút/lịch sử: Bắt đầu công việc, Tiếp tục công việc, Nhận máy về xử lý; thông báo bắt đầu dùng cùng từ ngữ. Không đổi mã command, trạng thái hoặc nghiệp vụ.

## Hàng giao kèm tạo PX khi tiếp nhận

- create_order nhận delivery_items (mã/tên, qty, serial/máy, kho 58 hoặc 145); tạo một PX nhiều dòng cùng transaction/version=1 của đơn. Ghi creator ID/tên/thời điểm, trạng thái Chờ thợ lấy, chưa có issued_qty. Replay dùng cùng receipt/sequence nên không tạo PX trùng. Mỗi máy một dòng SL 1; serial có thể bổ sung khi thực lấy nhưng phải khớp nếu PX đã có serial.
- Người tạo PX, kho hoặc director được edit_delivery_issue trước lần lấy đầu: thay/thêm/bớt dòng hoặc hủy có lý do. Giữ cùng số PX; lưu before/after, người sửa và thời gian trong revisions, hiển thị lịch sử sửa PX. Sửa làm mất cờ Đã soạn để kho kiểm lại; version guard chặn form cũ. Không tự chuyển DX/PX/đơn đã lưu ở bản cũ.
- Tab Cần soạn hàng cho warehouse/director: PX pending theo giờ hẹn/ngày thực hiện, kho 58/145, số còn lấy, người tạo/thợ. prepare_delivery đánh dấu Đã soạn nhưng không bắt buộc và không tăng lượng hàng đã rời kho.
- pickup_delivery: thợ được giao chọn PX, Đã lấy đủ để tích/điền toàn bộ số còn lấy, bỏ tích món thiếu hoặc nhập thực lấy; kiểm serial. Tăng picked_qty/issued_qty chỉ theo số thực lấy, ghi người/thời điểm và lịch sử các lần lấy. Có lấy dù chỉ một món thì khóa sửa/hủy PX; phần thiếu tiếp tục Chờ lấy. Theo câu trả lời người dùng: phải lấy đủ toàn bộ mới được start/schedule_start/resume. Vẫn giao thợ và hẹn trước khi kho soạn/lấy; khi lấy thiếu có thể xác nhận lấy nốt sau, không lấy trùng phần đã nhận.
- Nghiệm thu/Ghi lượng dùng: flow delivery lưu delivered_qty/bring_back_qty và hiển thị Đã giao khách/Mang về; consumables giữ Đã dùng. Khách không nhận/nhận một phần thì surplus chờ kho return_parts tạo PN theo số thực mang về. Cancel đơn khi đã lấy cần director; PN sau hủy chỉ nhận số đã lấy, không nhận số mới có trên kế hoạch.
- Chuyển/giao lại trước pickup cập nhật người nhận ở dòng PX theo thợ mới; sau pickup còn hàng thợ đang giữ thì HANDOVER_REQUIRED như luồng cũ. Sau giao/PN đã giải phóng lượng đang giữ không tính lại hàng trên kế hoạch là custody. Thợ vẫn wait_parts → kho issue_parts → thợ receive_parts cho phát sinh; dispatcher không được bypass issue_parts của DX cũ.
- Kiểm thử: 56/56 Node (thêm 9 nghiệp vụ); 9 kịch bản trình duyệt mới với điều phối/kho/thợ; 48 UI cũ, 9 GAS iframe và GAS VM bridge tạo/lấy PX chạy được; kiểm ảnh/queue và đồng bộ hai màn hình lại trước xuất bản. Không xác nhận đã UAT chức năng mới trên Google/điện thoại thật.

**Trước dùng thật:** PX/PN mới chỉ ghi trong app Điều phối. Tồn kho thật vẫn ở QL_KHO_THANH_DUC, chưa reserve/trừ tồn khi tạo PX hoặc pickup ở app Kho. Phải nối catalogue/mã TD, kho/vị trí, serial và ghi phiếu/movement sang app Kho theo idempotency key chung, có đối soát và retry, để nhân viên không nhập hai lần. Cần nối chuyển kho → thợ đang giữ ở thời điểm pickup và trả PN về đúng kho nguồn; chưa có đồng bộ này. Normalized tables và chống lạm dụng đăng nhập vẫn là mốc bắt buộc trước pilot.

## Quản lý máy qua hồ sơ khách

- UI Tiếp nhận bỏ machine_model/machine_serial; máy tùy chọn, nhãn Chưa chọn máy, danh sách model/serial/vị trí chỉ thuộc khách và active !== false. Có đúng một máy đang sử dụng thì tự chọn; người dùng vẫn bỏ chọn được. Máy cũ thiếu active/location được xem là đang sử dụng, không migration/ghi đè dữ liệu cũ.
- create_customer nhận machines[] (model, serial, location), lưu khách + tối đa 50 máy trong một transaction/root revision; replay không tạo trùng, dòng lỗi không lưu một phần. Form trang khách và inline cùng editor nhiều dòng. Inline giữ draft, ngày/giờ, nguồn/ưu tiên, địa chỉ riêng và các dòng hàng giao kèm; chọn khách mới và máy duy nhất khi quay lại.
- update_customer/update_machine chỉ dispatcher/director, kiểm expected_version của entity. Máy không chuyển customer_id qua edit. Lưu before/after ở sự kiện; giữ ID/created_at, không xóa; active=false ẩn ở intake/attach, có thể kích hoạt lại. Edit không viết lại customer_snapshot/machine_snapshot trong đơn đã tạo. Khách / máy mở từng khách, sửa thông tin, thêm/sửa máy và lọc lịch sử đơn bằng machine_id (cả đơn kết thúc).
- Serial không trống so sánh trim/case-insensitive trong cùng khách, kể cả máy đã ngừng; cảnh báo tại form và trong result.warnings/DUPLICATE_SERIAL. Cảnh báo không chặn lưu, không tự gộp dữ liệu. Cảnh báo số điện thoại cũ vẫn giữ được cùng cảnh báo serial.
- attach_machine gắn cho đơn chưa có máy, kiểm đúng khách/MACHINE_CUSTOMER_MISMATCH, active và version. Dispatcher/director được gắn lịch sử sau tiếp nhận; thợ được giao chỉ khi working, không tự tạo/sửa hồ sơ. Có sự kiện order kèm before/after/machine_id. Máy đã gắn không bị thay thế qua command này. Query thợ chỉ cấp máy thuộc khách của các đơn họ có quyền đọc, không mở toàn bộ danh mục khách/máy; kho không nhận danh mục máy nếu không có vai trò quản lý/thợ.
- create_machine và create_order cũ có machine_model/machine_serial giữ API tương thích; UI không dùng tạo nhanh trong intake. Snapshot đơn/ID máy cũ giữ nguyên. Chưa nhập/gộp danh mục máy từ các app cũ hoặc nối app Kho/Care.
- Kiểm chứng: 63/63 Node (thêm 7 case hồ sơ/quyền/atomic/legacy), 10 kịch bản trình duyệt hồ sơ mới; 48 UI cũ cập nhật bài tạo máy nhanh thành chọn hồ sơ, 9 giao hàng, 9 GAS iframe, kiểm ảnh/queue và 9 đồng bộ. GAS VM bridge cũng tạo khách kèm hai máy, ngừng máy và attach đơn; đây là kiểm thử local/CI, cần UAT tính năng trên Google.

Bổ sung giữ lựa chọn Chưa chọn máy nếu người nhận đơn đã chủ động bỏ chọn rồi mở/hủy form tạo khách inline; chỉ tự chọn máy duy nhất khi chuyển khách hoặc lưu khách mới.

CI bắt được race đóng form trước refresh: có khoảng trống giao diện vẫn là đơn cũ sau khi server đã lưu. submitForm nay chỉ đóng dialog sau foreground refresh thành công; nếu query lỗi, form/key còn nguyên để retry không ghi trùng. Không nới kiểm thử hay thay nghiệp vụ.

## Giá, thu tiền, nộp quỹ và đóng hồ sơ — 14/10/2026

- Theo SPEC_V1_1 mục 8–10: đơn giá hàng giao kèm nhập ở tiếp nhận PX; snapshot nghiệm thu tính theo delivered_qty, không tính hàng Mang về. Thợ nhập các dòng công/dịch vụ và vật tư tính tiền, xác nhận Khách đã đồng ý giá. Không có bảng giá/giá mặc định; 0đ cần xác nhận miễn phí. Nghiệm thu mới thiếu giá/đồng ý bị chặn cả API. Đơn đã nghiệm thu từ bản cũ giữ nguyên, hiện Chưa chốt tiền và cần điều phối/giám đốc Điều chỉnh giá trước thu/đóng, không migration thành 0đ.
- Phí không làm được tổng 0–200.000đ, lý do và khách đồng ý; 0đ ghi Miễn phí. Tổng tiền snapshot gồm goods/labor/materials, ghi actor/thời điểm/revision/source Báo giá riêng. revise_prices chỉ dispatcher/director, lý do + khách đồng ý, giữ billing_history và before/after; không giảm dưới khoản đã xác nhận/chờ vì hoàn tiền chưa làm. Sau đóng không sửa trực tiếp. Ngưỡng duyệt có cấu hình director, mặc định tắt; bật lên phải propose_prices → director approve_prices đúng giá/số lượng trước complete, không tự duyệt báo giá của mình.
- Chốt/sửa giá PX riêng có lý do để bổ sung giá cho hàng cũ trước nghiệm thu. Kho sửa lượng trước lấy giữ giá từ dòng cũ tin cậy, không tin giá client gửi; dòng thêm chưa giá cần điều phối chốt. Thợ không override giá hàng trong complete. Kho không nhận billing, giá hiện hành/lịch sử PX hoặc sự kiện giá qua query.
- Director quản lý payment_methods và company_accounts: thêm/đổi tên/ngừng dùng, không xóa; chứng từ giữ snapshot tên/loại/tài khoản. Seed Tiền mặt, CK Vietcombank công ty, CK tài khoản khác, không tự tạo số tài khoản thật/giả. Transfer cần chọn company account active, nội dung TD; POS/Khác có thể thêm. Ngừng dùng không đổi chứng từ đã ghi. Tiền VND số nguyên không âm, kiểm safe integer cả tổng/tích số lượng.
- report_payment sau nghiệm thu hoặc không làm được đã chốt phí: chỉ thợ đang được giao, không khách credit. Ô tiền trống, Thu đủ phải bấm; nhiều phương thức/từng phần, chặn vượt sau tính cả pending. PT-yyyymmdd tự cấp cùng journal/command, replay không tăng sequence. Mã giao dịch ngoài chống trùng theo nguồn tài khoản/hình thức. Cash báo thu → tiền thợ giữ ngay, chưa gọi là về quỹ; transfer/POS/Khác pending, không vào custody. confirm/reject chỉ finance/director, không tự xác nhận, từ chối phải lý do và trả lại số còn được thu; cash đối soát bằng NQ, không từ chối để xóa trách nhiệm.
- Ảnh biên lai tùy chọn chọn/chụp từ khoản thu, tự queue/thumbnail private như ảnh nghiệm thu, không query toàn bộ sau upload; kiểm nguồn payment_id + actor + đơn dưới lock. Finance xem ảnh qua API được xác thực; không public Drive. Biên lai không thay thế xác nhận sao kê.
- Thợ: Tài khoản → Tiền tôi đang giữ, PT/TD/tổng/ngày giữ, chọn từng khoản hoặc tất cả → create_deposit một NQ nhiều đơn, xác nhận đã giao tiền. NQ pending giữ chỗ bằng allocations tới PT, không giảm held, không lập lại cùng tiền. confirm_deposit nhập actual_amount, ghi chú bắt buộc khi lệch, phân bổ theo thứ tự khoản trong phiếu. Đủ = Đã đối soát; thiếu/thừa = Có sai lệch. Thiếu vẫn held và có thể lập NQ bổ sung; chỉ actual được quỹ xác nhận làm giảm held. Thừa ghi unallocated_excess riêng, không tự tăng thanh toán khách, không tạo PT giả; kế toán cần xử lý ngoài luồng hiện tại. Chứng từ lưu actor/thời gian/số theo nguồn và lịch sử từng đơn. Không tự nhận NQ của mình hoặc nguồn do mình báo.
- Cash xác nhận từng phần theo số thực nhận: confirmation entries tránh cộng lại khi nộp phần thiếu sau đó hoặc tiền đã được xác nhận riêng. Báo cáo tách ngày báo thu, ngày xác nhận và ngày về quỹ; không cộng phiếu cha với allocations. Ngày nghiệm thu/thợ: doanh thu hàng/công/vật tư, còn phải thu; ngày/thợ/phương thức: reported/confirmed/in_fund; held theo từng thợ. Khoản giữ hơn 24 giờ tô đỏ. Không dùng tổng cash báo thu làm tiền về quỹ.
- Finance có trang Quỹ: CK/POS/Khác pending, NQ chờ nhận và sai lệch, held theo thợ, bộ lọc ngày/thợ, số tổng riêng. Finance không có quyền command sửa khách/máy/công việc/vật tư/phân công/cấu hình giá. Thợ chỉ nhận PT/NQ của mình, không xem hoặc nộp tiền thợ khác. Cash còn giữ chặn chuyển thợ, trách nhiệm không tự chuyển.
- Thẻ/chi tiết hiện Chưa thanh toán/Một phần/Đã đủ theo số đã xác nhận; pending và phần còn được báo thu riêng; trạng thái cash còn ở thợ/chờ quỹ/đã về quỹ. close_dossier kiểm nghiệm thu, snapshot/duyệt giá xong, toàn bộ vật tư/máy đã quyết toán, không pending, thu ngay đủ xác nhận, cash về quỹ. Credit giữ nguyên credit_remaining_at_close; không tự xóa nợ. Đã đóng thành tab riêng, nút công việc ẩn, server chặn sửa trực tiếp.

**Kiểm chứng bản này:** 84/84 Node, gồm 21 kịch bản tiền (thu một phần/nhiều phương thức, vượt/credit, pending/reject, custody, nhiều đơn/NQ, reserve/replay, thiếu/thừa, self-confirm, hàng Mang về, sửa giá/miễn phí/ngưỡng duyệt, đóng, phân quyền, ngày xác nhận và giá kho). Bridge GAS compiled chạy PT/NQ/đối soát/đóng qua workbook/journal giả lập. 11 kịch bản money-browser với thợ 390px và finance/director/tech2; kiểm ảnh biên lai private, thiếu rồi nộp bổ sung, tab Đã đóng. Hồi quy UI 48, hồ sơ máy 10, giao hàng 9, GAS iframe 9, ảnh/queue và live hai phiên chạy lại; kết quả riêng trong *-results.json. Kiểm thử local/CI không thay thế UAT thu/nộp trên Google thật. ERP cũ 71/71; một lượt gặp race khởi tạo marker fixture giữa process của suite cũ (FIXTURE_MARKER_MISMATCH), chạy lại đạt; không sửa hoặc nới assertion của module cũ.

### Mốc trước pilot / việc để sau theo yêu cầu

1. Chưa ghi dữ liệu/chứng từ sang FINANCE_THANHDUC. Cần nối PT/NQ đã xác nhận sang app Finance theo source ID/idempotency, có retry/đối soát để kế toán không nhập hai lần; không ghi vào Finance hiện hành trong bản này.
2. QR theo mã đơn, hoàn tiền, phân bổ công nợ theo kỳ chưa làm. Giá giảm dưới đã báo thu, chi hoàn, phân bổ thừa hoặc đóng hồ sơ hủy/ngoại lệ cần luồng riêng, không tự xóa khoản hoặc dấu vết.
3. Nối mã TD/PX/PN sang QL_KHO_THANH_DUC trước dùng thật; vật tư/tồn thật vẫn ở app Kho. Không coi PX điều phối là đã trừ tồn app Kho.
4. Bắt buộc thay persistence toàn snapshot bằng normalized tables/index cho orders, prices, payments, deposit allocations/confirmations, evidence/events/idempotency; retention/backup/migration/recovery. Snapshot và journal tăng nhanh hơn khi có sổ tiền; tối ưu ảnh/polling không giải quyết giới hạn này.
5. Chốt hạn nộp quỹ/giờ cắt và ngoại lệ, ma trận giá; chống lạm dụng login/quota ANYONE_ANONYMOUS/PBKDF2, cùng UAT Google/điện thoại và đối chiếu sao kê/quỹ thực tế. Cảnh báo >24h hiện tại không tự đặt hạn thu giữ hoặc cho phép ngoại lệ giữ tiền để đóng.

API payment_status cũng lấy từ sổ thu hiện tại, cùng nguồn với nhãn trên UI, thay cho placeholder unpaid cũ; không viết lại trạng thái tiền lịch sử bằng suy đoán. Kho không nhận payment_status/financial_scope qua projection.
