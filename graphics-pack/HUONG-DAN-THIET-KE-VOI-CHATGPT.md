# 🎨 Hướng Dẫn Thiết Kế Lại Đồ Họa Game "Ma Chó" Với ChatGPT

Chào bạn! Toàn bộ hình ảnh, cấu hình căn chỉnh vòng tròn và công cụ tách nền tự động của game **"Ma Chó"** đã được đóng gói gọn vào thư mục **`graphics-pack/`** này. Bạn **không cần biết lập trình** — chỉ cần tạo ảnh trên **ChatGPT (GPT-4o Image)**, bỏ vào thư mục tương ứng và mở phòng thử đồ họa để xem kết quả ngay lập tức!

---

## 1. Cấu Trúc Thư Mục `graphics-pack/`

| Thư mục / File | Công dụng | Định dạng & Kích thước chuẩn |
| :--- | :--- | :--- |
| **`assets/backgrounds/`** | Ảnh nền Sảnh chờ, Ban ngày và Ban đêm | `.jpg` hoặc `.png`, tỉ lệ **16:9** (`1920x1080` hoặc `1376x768`) |
| **`assets/characters/`** | 22 nhân vật dân làng | `.png` **nền trong suốt**, kích thước **`512x512`**, chân chạm sát gần đáy (`~96%` chiều cao) |
| **`assets/props/`** | Đống lửa cháy, Đống lửa tắt, Bia mộ hồn ma | `.png` **nền trong suốt**, kích thước **`512x512`** |
| **`assets/roles/`** | *(Tùy chọn)* Icon riêng cho 11 vai trò | `.png` **nền trong suốt**, **`256x256`** hoặc **`512x512`**. Chưa có file nào thì game tự dùng Emoji |
| **`assets/throwables/`** | *(Tùy chọn)* Icon đồ ném bay (trứng, cà chua, bia...) | `.png` **nền trong suốt** |
| **`raw-chatgpt/`** | Nơi bỏ ảnh thô mới tải từ ChatGPT về để tool tự tách nền trắng | `.jpg` / `.png` (lẻ hoặc bảng 4 ô `2x2`) |
| **`themeConfig.js`** | Chỉnh tọa độ vòng tròn nhân vật, cỡ chữ/sprite và hiệu ứng chạm | File JS đơn giản có chú thích tiếng Việt |
| **`1-tach-nen-tu-chatgpt.bat`** | Nhấp đúp để tự động cắt bảng `2x2` + tách nền trắng thành PNG `512x512` | Chạy trên Windows |
| **`2-xem-thu-do-hoa.bat`** | Nhấp đúp để mở **Phòng Thử Đồ Họa (`?preview=art`)** xem ngay trên trình duyệt | Tự cập nhật khi bạn thay ảnh mới |

---

## 2. Bí Quyết Để 22 Nhân Vật Đồng Bộ 1 Phong Cách Trên ChatGPT

> [!TIP]
> **Rất quan trọng:** Hãy vẽ **toàn bộ** nhân vật và bối cảnh trong **cùng 1 đoạn chat duy nhất** trên ChatGPT!
>
> 1. **Bước A (Chốt "Master Style")**: Ở tin nhắn đầu tiên, gửi kèm **1 ảnh phong cách bạn muốn** (hoặc mô tả chi tiết nét vẽ, bảng màu, độ dày viền, tỉ lệ đầu/thân chibi) và bảo ChatGPT: *"Hãy ghi nhớ đây là Master Art Style cho toàn bộ dự án game của tôi. Từ giờ mọi ảnh tôi yêu cầu đều phải giữ đúng nét vẽ, độ dày viền và màu sắc này."*
> 2. **Bước B (Vẽ nền trước, nhân vật sau)**: Khi vẽ nhân vật, luôn nhắc câu: *"Giữ đúng nét vẽ của nhân vật trước, chỉ vẽ 1 nhân vật toàn thân đứng thẳng nhìn hơi chéo 3/4, KHÔNG vẽ bóng đổ dưới chân, nền trắng tinh `#FFFFFF` (hoặc nền trong suốt), viền đen đậm khép kín."*

---

## 3. Bộ Prompt Mẫu Copy-Paste Cho ChatGPT

### A. Prompt vẽ Ảnh Nền Sân Làng (`backgrounds/bg_day.jpg` & `bg_night.jpg`)

> [!IMPORTANT]
> Hãy nhắc ChatGPT **CHỪA TRỐNG** phần quảng trường ở chính giữa (khoảng tâm `x = 50%`, `y = 54%`), không vẽ người, không vẽ đống lửa sẵn và không vẽ nút bấm UI — vì code game sẽ tự xếp người chơi và đống lửa vào đúng vòng tròn đó!

* **Prompt Nền Ban Đêm (`bg_night.jpg`)**:
  > Vẽ ảnh nền game 2D tỉ lệ ngang 16:9 theo góc nhìn xiên 2.5D từ trên xuống (top-down oblique). Bối cảnh một quảng trường làng cổ vào ban đêm dưới bầu trời xanh tím thẫm đầy sao và vầng trăng tròn sáng ở khoảng trống bầu trời phía trên giữa. Xung quanh hai bên rìa trái phải là các ngôi nhà gỗ mái ngói đèn lồng vàng ấm áp, hai góc dưới cùng có mái nhà tiền cảnh tạo chiều sâu. Chính giữa là một sân gạch đá hình tròn đồng tâm rộng lớn, hắt ánh sáng cam ấm áp ở tâm sân. **QUAN TRỌNG**: Quảng trường ở giữa phải HOÀN TOÀN TRỐNG, không vẽ nhân vật, không vẽ đống lửa, không vẽ chữ hay nút giao diện game.

* **Prompt Nền Ban Ngày (`bg_day.jpg`)**:
  > Vẽ lại ĐÚNG bố cục và vị trí nhà cửa của bức ảnh quảng trường trên, nhưng chuyển sang **BAN NGÀY nắng đẹp**: bầu trời xanh trong với mây trắng bồng bềnh, nắng vàng rực rỡ, bãi cỏ xanh mướt, hoa và bụi cây tươi tắn, mặt sân đá sáng rõ. Quảng trường giữa sân vẫn **HOÀN TOÀN TRỐNG** (không có người, không có lửa, không có chữ hay UI).

---

### B. Prompt vẽ Từng Nhân Vật Lẻ (Hoặc Bảng 4 Nhân Vật `2x2`)

#### Cách 1: Vẽ từng nhân vật lẻ (Dễ kiểm soát nét nhất)
> Vẽ **1 nhân vật game 2D chibi toàn thân** đứng giữa khung hình vuông 1:1 trên **nền trong suốt** (hoặc nền trắng tinh `#FFFFFF` tuyệt đối), chừa lề trống rộng xung quanh, **KHÔNG vẽ bóng đổ dưới chân, KHÔNG có chữ**, có đường viền mực đen đậm khép kín xung quanh nhân vật theo đúng Master Style đã chốt.
> Nhân vật: **[MÔ TẢ NHÂN VẬT TỪ BẢNG BÊN DƯỚI]**.

#### Cách 2: Vẽ 1 lần 4 nhân vật (`2x2`) cho nhanh (Tool sẽ tự cắt & tách nền!)
> Tạo ảnh tỉ lệ ngang 16:9 chia làm 4 góc đều nhau (Trên-Trái, Trên-Phải, Dưới-Trái, Dưới-Phải) trên **nền trắng tinh `#FFFFFF` tuyệt đối**. Đặt đúng 4 nhân vật chibi toàn thân tách rời nhau hẳn, chừa khoảng trắng rộng giữa 4 người — **KHÔNG vẽ đường kẻ chia ô, KHÔNG ghi chữ, KHÔNG vẽ bóng đổ dưới chân**, mỗi nhân vật có viền mực đen đậm khép kín:
> - Trên-Trái: [Mô tả 1]
> - Trên-Phải: [Mô tả 2]
> - Dưới-Trái: [Mô tả 3]
> - Dưới-Phải: [Mô tả 4]

---

## 4. Bảng Tra Cứu Đúng Tên File Cần Lưu

> [!WARNING]
> Đặt **chính xác tên file** (chữ thường, không dấu, đuôi `.png`) thì game mới tự nhận đúng nhân vật!

### 22 Nhân Vật Dân Làng (`assets/characters/<tên>.png`)
| Tên file chuẩn | Nhân vật trong game | Gợi ý mô tả cho ChatGPT |
| :--- | :--- | :--- |
| `drunkard.png` | **Gã Bợm Rượu** | Anh chàng mũi đỏ say xỉn, áo rách vá, tay cầm cốc bia bọt và chai rượu thủy tinh xanh |
| `madman.png` | **Thằng Điên** | Gã mắt trợn cười điên dại, đội ngược chiếc nồi nhôm bạc trên đầu |
| `glutton.png` | **Anh Chàng Tham Ăn** | Anh chàng mũm mĩm vui vẻ, tay cầm đùi gà nướng vàng ruộm khổng lồ |
| `beggar.png` | **Gã Ăn Xin** | Ông chú râu ria xồm xoàm mặc áo choàng vá chằng chịt, tay cầm gậy gỗ và bát mẻ |
| `smoker.png` | **Gã Nghiện Thuốc Lá** | Anh chàng ngầu lòi mắt thâm quầng, mặc áo khoác tối màu, tay kẹp điếu thuốc đang cháy |
| `waterpipe.png` | **Anh Hút Thuốc Lào** | Anh nông dân áo bà ba xanh cười tít mắt, tay ôm ống điếu cày bằng tre xanh |
| `blacksmith.png` | **Anh Thợ Rèn** | Người đàn ông cơ bắp râu rậm mặc tạp dề da, vác búa tạ sắt to trên vai |
| `oldman.png` | **Ông Già** | Cụ ông hiền hậu râu tóc bạc phơ dài, mặc áo cổ tàu, chống gậy gỗ |
| `oldwoman.png` | **Bà Cụ** | Bà lão tóc búi bạc, đeo kính tròn, choàng khăn tím, chống gậy nhỏ |
| `kid.png` | **Trẻ Con** | Cậu bé mặc quần yếm, đội mũ chong chóng nhiều màu, tay cầm ná cao su |
| `youth.png` | **Anh Thanh Niên** | Chàng trai năng động mặc áo gile xanh ngọc, quàng khăn đỏ tung bay |
| `grocer.png` | **Anh Tạp Hóa** | Ông chủ tiệm mặc tạp dề xanh lá, tay cầm cuốn sổ nợ vàng và túi tiền xu |
| `florist.png` | **Cô Bán Hoa** | Cô gái xinh xắn mặc váy hồng xanh tươi tắn, ôm bó hoa rực rỡ sắc màu |
| `butcher.png` | **Anh Bán Thịt (Đồ Tể)** | Gã hói đầu ria mép rậm, mặc tạp dề trắng dính vệt đỏ, giơ dao phay bản lớn |
| `farmer.png` | **Bác Nông Dân** | Người nông dân đội nón lá vàng, tay ôm bó lúa chín và cuốc |
| `baker.png` | **Chị Thợ Bánh** | Cô thợ làm bánh đội mũ đầu bếp trắng phồng, ôm những ổ bánh mì vàng giòn |
| `fisher.png` | **Anh Đánh Cá** | Người câu cá mặc áo gile xanh dương, đội mũ rộng vành, cầm cần câu tre có cá bạc |
| `tailor.png` | **Cô Thợ May** | Cô thợ may đeo kính tròn, tạp dề cắm kim chỉ, tay cầm kéo lớn và cuộn chỉ màu |
| `lumberjack.png` | **Chú Tiều Phu** | Chú tiều phu râu quai nón, đội mũ len, mặc áo sơ mi caro đỏ vác rìu bổ củi |
| `herbalist.png` | **Cô Thảo Dược** | Cô gái choàng áo mũ trùm xanh lá huyền bí, cầm bình thuốc phát sáng xanh và giỏ lá thuốc |
| `watchman.png` | **Anh Gác Đêm** | Người gác đêm đội mũ sắt, áo giáp nhẹ, tay xách đèn lồng vàng sáng và cầm giáo |
| `shepherd.png` | **Bé Chăn Cừu** | Chú bé mặc áo gi-lê lông cừu, cầm gậy móc cong kèm chú cừu bông nhỏ bên cạnh |

### Vật Thể & Giao Diện (`assets/props/` & `assets/roles/`)
* **`assets/props/campfire_lit.png`**: Đống lửa trại đang cháy rực trên củi xếp chéo và vòng đá nhỏ.
* **`assets/props/campfire_out.png`** *(tùy chọn)*: Đống củi cháy xém đã tắt lửa, chỉ còn than xám. *(Nếu chưa tạo, game tự làm tối `campfire_lit.png`)*.
* **`assets/props/ghost_tombstone.png`**: Bia mộ đá phủ rêu có chú hồn ma nhỏ dễ thương bay bên cạnh.
* **`assets/roles/<roleId>.png`** *(tùy chọn — nếu muốn thay Emoji vai trò)*:
  `villager.png`, `mayor.png`, `seer.png`, `guard.png`, `witch.png`, `hunter.png`, `elder.png`, `cupid.png`, `werewolf.png`, `cursed_wolf.png`, `jester.png`.

---

## 5. Quy Trình 3 Bước Làm Việc Siêu Nhanh

1. **Bước 1 — Tách nền tự động (nếu dùng ảnh ChatGPT nền trắng)**:
   - Nếu xuất ảnh từ ChatGPT có nền trắng: lưu vào **`graphics-pack/raw-chatgpt/`** theo tên:
     - Ảnh đơn: `drunkard.png` (hoặc `role_werewolf.png`, `prop_campfire_lit.png`).
     - Ảnh bảng `2x2` 4 người: `sheet_drunkard_madman_glutton_beggar.jpg`.
   - Nhấp đúp **`1-tach-nen-tu-chatgpt.bat`** $\rightarrow$ Tool tự cắt, khử viền trắng và lưu PNG `512x512` vào đúng thư mục `assets/`.
   - *(Nếu bạn đã tự xuất PNG nền trong suốt sẵn bằng Photoshop/Figma/Canva thì chép thẳng vào `graphics-pack/assets/characters/` là dùng luôn!)*
2. **Bước 2 — Xem thử ngay trên trình duyệt**:
   - Nhấp đúp **`2-xem-thu-do-hoa.bat`** để mở **Phòng Thử Đồ Họa (`?preview=art`)**.
   - Test chuyển **Ban Ngày / Ban Đêm**, thử đổi số lượng người (`4–16`), bấm thử từng nhân vật để kiểm tra viền cắt trên nền caro trong suốt.
   - Nếu đổi nền mới và thấy vòng tròn người ngồi hơi lệch tâm sân: kéo 4 thanh trượt trong Phòng Thử Đồ Họa để tìm số đẹp rồi chép vào mục `ARENA_LAYOUT` trong **`graphics-pack/themeConfig.js`**.
3. **Bước 3 — Gửi lại để cập nhật lên web**:
   - Chỉ cần nén toàn bộ thư mục **`graphics-pack/`** gửi lại cho bạn (hoặc đẩy thẳng lên GitHub repo) là toàn bộ game trên mạng sẽ tự khoác bộ áo mới!
