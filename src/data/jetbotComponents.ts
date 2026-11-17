/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { JetBotComponentInfo } from '../types/jetbot';

export const JETBOT_COMPONENTS: JetBotComponentInfo[] = [
  {
    id: 'wheels',
    name: 'Blue Metallic Rim Wheels & 1:48 Geared TT Motors',
    nameVi: '1. Bánh Xe Mâm Xanh Dương & Động Cơ Giảm Tốc TT',
    category: 'mechanical',
    description:
      'Cụm truyền động vi sai kép gồm 2 bánh xe đường kính 65mm mâm hợp kim 10 chấu sơn xanh dương metallic mạ bóng. Lớp lốp cao su gai nổi (knobby off-road tread) tạo hệ số ma sát bám sàn cao. Dẫn động trực tiếp bởi cặp động cơ điện một chiều TT Motor hộp số giảm tốc bánh răng kim loại tỷ số truyền 1:48.',
    functions: [
      'Thực hiện điều khiển vi sai 2 bánh (Differential Drive Kinematics) giúp robot xoay tại chỗ (bán kính quay R = 0).',
      'Chuyển đổi năng lượng điện thành mô-men xoắn cơ học (lực kéo cực đại ~0.8 kg.cm tại 6V).',
      'Duy trì bám đường tin cậy trên các bề mặt sàn gạch men, thảm hoặc sàn thi đấu robot tự hành CMU.',
      'Cung cấp tín hiệu ước lượng vận tốc góc thông qua điều khiển xung PWM điều chế độ rộng.',
    ],
    aiRole:
      'Chấp hành các lệnh vận tốc `cmd_vel` từ mạng nơ-ron điều hướng (Object Avoidance CNN / Line Following Model) và bộ điều khiển quỹ đạo bám đường Pure Pursuit / DWA Planner.',
    hardwareInterface: {
      protocol: 'Điều khiển cầu H PWM (H-Bridge PWM + Hướng quay DIR)',
      pinout: '2 dây DC Motor (+ / -) nối vào cầu đấu vít Motor A & Motor B trên bo Waveshare',
      voltage: '3.0V - 9.0V DC (Điện áp làm việc tối ưu: 6.0V - 7.4V)',
      powerConsumption: '150mA (không tải), đỉnh 1.2A (khi kẹt tải/khởi động)',
    },
    rosNode: {
      packageName: 'jetbot_ros_diff_drive',
      launchCommand: 'ros2 run jetbot_ros motor_controller_node --ros-args --params-file params/motor_pid.yaml',
      topics: ['/cmd_vel (geometry_msgs/Twist)', '/motor/left_rpm', '/motor/right_rpm'],
    },
    practicalNotes:
      'Bánh xe TT motor cần được hiệu chuẩn tốc độ (calibration offset) trong file cấu hình robot, bù đắp sai số cơ khí giữa 2 động cơ để robot đi thẳng chuẩn tuyệt đối.',
    specs: {
      'Đường kính ngoài bánh': '65 mm',
      'Bề rộng lốp cao su': '26 mm',
      'Mâm bánh xe': '10 chấu mạ màu xanh dương ánh kim (Electric Blue)',
      'Tỷ số truyền hộp số': '1:48 (Metal-hybrid gear train)',
      'Tốc độ quay tối đa': '200 RPM (tương đương vận tốc di chuyển 0.68 m/s)',
      'Mô-men xoắn danh định': '0.8 kgf.cm @ 6V',
    },
    explodeOffset: { x: -0.28, y: 0, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/b_nh_xe_154d4004.jpg',
        caption:
          'Ảnh chụp thực tế cận cảnh bánh xe JetBot: mâm hợp kim 10 chấu màu xanh dương ánh kim, ốc tâm trục lục giác M3 và lốp cao su gai nổi bám đường.',
        perspective: 'Cận cảnh mâm xanh & lốp gai (Real Wheel Close-up)',
      },
      {
        url: '/assets/aistudio/anh4_99530e72.jpg',
        caption:
          'Góc nhìn toàn cụm bánh xe chủ động lồng gọn trong khe khung gầm nhôm anodized xanh lá.',
        perspective: 'Cụm bánh xe & khe gá khung (Wheel Slot Mounting)',
      },
    ],
  },
  {
    id: 'motorBoard',
    name: 'Waveshare Motor Driver & Battery Management Board',
    nameVi: '2. Bo Mạch Điều Khiển Động Cơ & Quản Lý Nguồn Waveshare',
    category: 'electronic',
    description:
      'Bo mạch điện tử chuyên dụng gắn tầng trung gian, tích hợp chip điều chế xung PWM 12-bit PCA9685 giao tiếp I2C, chip cầu H kép TB6612FNG công suất cao, mạch hạ áp xung DC-DC 5V/5A cấp nguồn cho Jetson Nano, mạch sạc cân bằng pin Li-ion 3S và màn hình OLED 0.91 inch hiển thị địa chỉ IP và mức pin.',
    functions: [
      'Nhận lệnh điều khiển qua bus I2C từ Jetson Nano để phát xung PWM độc lập cho từng động cơ.',
      'Quản lý an toàn khối pin 3S 18650 (tự động ngắt khi điện áp dưới 9.6V hoặc khi quá dòng).',
      'Cung cấp đường nguồn 5V ổn định cao dòng cực đại 5A nuôi riêng bo Jetson Nano và cổng camera CSI.',
      'Hiển thị trực quan địa chỉ IP mạng Wi-Fi và % dung lượng pin trên màn hình OLED tích hợp.',
    ],
    aiRole:
      'Bộ đệm chấp hành phần cứng thời gian thực. Giảm tải hoàn toàn việc tạo xung PWM khỏi CPU của Jetson Nano, bảo toàn 100% tài nguyên CPU/GPU cho inference mô hình học sâu.',
    hardwareInterface: {
      protocol: 'I2C Bus chuẩn Fast-mode 400 kHz (Địa chỉ phần cứng: 0x60 cho PCA9685, 0x3C cho OLED)',
      pinout: 'Chân 3 (SDA), Chân 5 (SCL), Chân 2 (5V Vin), Chân 6 (GND) cắm vào 40-pin Jetson header',
      voltage: 'Đầu vào: 11.1V - 12.6V (Pin 3S Li-ion); Đầu ra: 5V/5A Regulated & 7.4V Motor VCC',
      powerConsumption: 'Tiêu thụ bo mạch tĩnh ~0.4W; Công suất nguồn tải tối đa 25W',
    },
    rosNode: {
      packageName: 'waveshare_jetbot_hardware',
      launchCommand: 'ros2 run waveshare_jetbot i2c_hardware_bridge_node',
      topics: ['/battery_state (sensor_msgs/BatteryState)', '/oled/display_text', '/motor_driver/fault'],
    },
    practicalNotes:
      'Tuyệt đối không cấp nguồn ngược cực pin 18650. Luôn bật công tắc nguồn trên bo mạch Waveshare trước khi cắm cáp Micro-USB nạp chương trình để tránh sụt áp gây reset chip Jetson.',
    specs: {
      'IC điều khiển PWM': 'PCA9685 16-channel 12-bit I2C Bus controller',
      'IC Driver Cầu H': 'Toshiba TB6612FNG Dual H-Bridge (1.2A liên tục, 3.2A đỉnh)',
      'Hạ áp DC-DC': 'MP1584 High-Efficiency Buck Converter 5V/5A',
      'Khay chứa pin': '3x Pin Li-ion 18650 ghép nối tiếp (11.1V danh định, 12.6V đầy)',
      'Màn hình hiển thị': '0.91" OLED 128x32 I2C Display',
    },
    explodeOffset: { x: 0, y: 0.28, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_6d2f76a5.jpg',
        caption:
          'Mặt sau bo mạch Waveshare: công tắc nguồn gạt ON/OFF, nút Reset, màn hình OLED 0.91", jack sạc 12.6V DC cho khối pin 3S 18650 và hàng chân GPIO 40-pin đánh dấu màu.',
        perspective: 'Mặt sau nguồn & OLED (Rear Power & OLED)',
      },
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_2_ce65c0d9.jpg',
        caption:
          'Mặt hông tầng bo mạch trung gian Waveshare: module chuyển đổi UART/USB Waveshare, núm chỉnh áp/âm lượng và các nút nhấn điều khiển phần cứng.',
        perspective: 'Cổng kết nối hông bo Waveshare (Side Bridge & Controls)',
      },
    ],
  },
  {
    id: 'jetson',
    name: 'NVIDIA Jetson Nano Developer Kit',
    nameVi: '3. Bo Mạch Máy Tính Trí Tuệ Nhân Tạo NVIDIA Jetson Nano',
    category: 'compute',
    description:
      'Bộ não điện toán trung tâm của JetBot, tích hợp vi xử lý ARM Cortex-A57 4 nhân 1.43 GHz và bộ xử lý đồ họa GPU NVIDIA Maxwell 128 nhân CUDA. Trang bị khối tản nhiệt nhôm đùn màu đen với các rãnh sâu và quạt làm mát điều tốc PWM 5V. Hỗ trợ đầy đủ thư viện NVIDIA JetPack, TensorRT, PyTorch, OpenCV và ROS2.',
    functions: [
      'Xử lý trực tiếp các luồng dữ liệu hình ảnh HD từ camera CSI ở tốc độ khung hình 30-60 FPS.',
      'Tăng tốc phần cứng cho mạng nơ-ron tích chập (CNN) thông qua engine tối ưu hóa TensorRT FP16.',
      'Chạy đồng thời các thuật toán bám làn đường, nhận diện biển báo, phát hiện người đi bộ và tính toán SLAM.',
      'Cung cấp máy chủ web Jupyter Notebook phục vụ đào tạo và điều khiển từ xa qua Wi-Fi.',
    ],
    aiRole:
      'Trung tâm suy luận AI (Inference Engine) và điều phối toàn bộ các tiến trình phần mềm tự hành. Chạy các mô hình như MobileNet-V2, YOLOv8-Nano, ResNet-18 với độ trễ suy luận chỉ 18ms.',
    hardwareInterface: {
      protocol: 'PCIe, USB 3.0, Gigabit Ethernet, MIPI CSI-2, I2C, SPI, UART, 40-pin GPIO',
      pinout: 'Header 40 chân chuẩn Raspberry Pi compatible (I2C1 SDA/SCL, UART TX/RX, 5V/GND)',
      voltage: '5V DC qua jack nguồn tròn DC Barrel Jack 5.5x2.1mm (khuyên dùng nguồn 5V/4A)',
      powerConsumption: 'Chế độ 5W Low Power hoặc 10W MAXN Full Performance Mode',
    },
    rosNode: {
      packageName: 'jetbot_ai_nodes',
      launchCommand: 'ros2 launch jetbot_bringup jetbot_autonav.launch.py use_tensorrt:=true',
      topics: ['/camera/image_raw', '/camera/detections', '/telemetry/cpu_gpu_stats', '/cmd_vel'],
    },
    practicalNotes:
      'Nên đặt jumper J48 trên bo để kích hoạt nguồn cấp qua jack DC thay vì cổng Micro-USB. Cần cấu hình quạt tản nhiệt tự động quay khi nhiệt độ vượt 48°C để tránh hiện tượng CPU Thermal Throttling.',
    specs: {
      'CPU': 'Quad-Core ARM Cortex-A57 MPCore @ 1.43 GHz',
      'GPU': 'NVIDIA Maxwell 128 CUDA Cores @ 921 MHz (472 GFLOPS FP16)',
      'Bộ nhớ RAM': '4 GB 64-bit LPDDR4 25.6 GB/s',
      'Lưu trữ': 'MicroSD card 64GB UHS-I tốc độ đọc 100MB/s',
      'Hệ điều hành': 'Ubuntu 18.04 LTS (JetPack 4.6.1 / CUDA 10.2 / cuDNN 8.2)',
    },
    explodeOffset: { x: 0, y: 0.72, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/qu_t_t_n_nhi_t_797085ee.jpg',
        caption:
          'Góc nhìn từ trên xuống cụm NVIDIA Jetson Nano: khối tản nhiệt nhôm đùn màu đen gắn quạt làm mát 40x40mm điều tốc PWM 5V cùng 4 cổng USB 3.0 và cổng LAN Gigabit.',
        perspective: 'Tản nhiệt & Quạt PWM từ trên xuống (Heatsink & Fan Top)',
      },
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_2_ce65c0d9.jpg',
        caption:
          'Cận cảnh hàng cổng giao tiếp tốc độ cao của Jetson Nano: jack nguồn DC 5V/4A, HDMI 2.0 + DisplayPort, 4x USB 3.0 Type-A, cổng Ethernet RJ45 và cầu USB Waveshare.',
        perspective: 'Cụm cổng I/O tốc độ cao (Jetson I/O Port Cluster)',
      },
    ],
  },
  {
    id: 'ports',
    name: 'Jetson Nano I/O Port Cluster & 40-Pin GPIO',
    nameVi: '4. Cụm Cổng Kết Nối Ngoại Vi, Nguồn & GPIO JetBot',
    category: 'electronic',
    description:
      'Tổ hợp giao tiếp ngoại vi tập trung dọc cạnh hông và mặt sau của JetBot, kết hợp hàng cổng I/O tốc độ cao của NVIDIA Jetson Nano (DC 5V/4A, DisplayPort, HDMI, 4× USB 3.0 Type-A, Gigabit Ethernet RJ45) cùng bộ mở rộng trên bo Waveshare gồm cầu nối USB-to-USB, cổng Micro-USB Debug/UART, hàng chân GPIO 40-pin đánh dấu màu, nút BOOT/RESET, công tắc nguồn ON/OFF và jack sạc 12.6V.',
    functions: [
      'Cung cấp 4 cổng USB 3.0 băng thông cao kết nối trực tiếp cảm biến RPLIDAR A1 (qua cầu USB Waveshare / CP2102), USB Wi-Fi phụ hoặc ổ cứng ngoài.',
      'Xuất tín hiệu hình ảnh độ phân giải cao qua HDMI 2.0 / DisplayPort để hiển thị giao diện Ubuntu & ROS2 trực tiếp lên màn hình phòng Lab.',
      'Truyền dữ liệu mạng tốc độ 1000 Mbps qua cổng Gigabit Ethernet RJ45 phục vụ SSH, cập nhật gói ROS2 và huấn luyện mô hình.',
      'Giao tiếp điều khiển động cơ I2C (chân 3 SDA / 5 SCL), nguồn 5V và cảm biến mở rộng thông qua header GPIO 40-pin chuẩn màu và cổng Micro-USB UART.',
    ],
    aiRole:
      'Đóng vai trò cầu nối dữ liệu vật lý giữa thế giới cảm biến bên ngoài (LiDAR USB, màn hình giám sát, mạng LAN, bus I2C động cơ) với GPU NVIDIA Jetson Nano.',
    hardwareInterface: {
      protocol: 'USB 3.0 SuperSpeed (5 Gbps), Gigabit Ethernet, HDMI 2.0/DP, UART, I2C, GPIO 40-Pin',
      pinout: 'Header 40-Pin (3.3V/5V/GND/SDA/SCL/TX/RX) + Cầu nối USB Waveshare + Jack DC 5V/4A & 12.6V',
      voltage: 'Đầu vào nguồn Jetson 5V DC (DC Barrel Jack) / Sạc pin 12.6V DC / Logic GPIO 3.3V',
      powerConsumption: 'Cấp nguồn ổn định tối đa 20W–25W cho toàn hệ thống qua cụm jack & cầu nối',
    },
    rosNode: {
      packageName: 'jetbot_io_diagnostics',
      launchCommand: 'ros2 launch jetbot_bringup hardware_interfaces.launch.py',
      topics: ['/diagnostics (I/O & USB Device Tree)', '/ttyUSB0 (RPLIDAR Bridge)', '/eth0/link_state'],
    },
    practicalNotes:
      'Khi nạp dữ liệu hoặc gỡ lỗi trực tiếp, gắn cầu nối USB Waveshare đúng chiều vào cụm cổng USB 3.0 để truyền tín hiệu giao tiếp bo điều khiển; kiểm tra công tắc ON/OFF và đèn LED báo nguồn 12.6V trước khi cấp điện.',
    specs: {
      'Cổng USB & Mạng': '4× USB 3.0 Type-A, 1× Gigabit RJ45 Ethernet, 1× Micro-USB UART',
      'Xuất hình & Âm thanh': '1× HDMI 2.0 + 1× DisplayPort (Stacked Cage)',
      'Mở rộng phần cứng': '40-Pin Color-Coded GPIO Header + Waveshare USB Bridge',
      'Nguồn & Điều khiển': 'DC Jack 5V/4A, Jack sạc pin 12.6V, Công tắc ON/OFF, Nút BOOT/RESET',
      'Hiển thị trạng thái': 'Màn hình OLED 0.91" I2C & LED báo nguồn 12.6V',
    },
    explodeOffset: { x: 0.28, y: 0.72, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_2_ce65c0d9.jpg',
        caption:
          'Cận cảnh hàng cổng kết nối cạnh bên của JetBot: Jack nguồn DC 5V/4A, DisplayPort + HDMI, 4× USB 3.0 gắn cầu nối Waveshare, cổng mạng LAN RJ45, nút bấm và núm chỉnh.',
        perspective: 'Cụm cổng I/O cạnh bên (Side I/O & USB Ports)',
      },
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_6d2f76a5.jpg',
        caption:
          'Mặt sau cụm kết nối & nguồn: Hàng chân GPIO 40-pin đánh dấu màu, cổng Micro-USB, nút RESET, công tắc ON/OFF, màn hình OLED 0.91" và jack sạc 12.6V.',
        perspective: 'Cổng kết nối sau & GPIO 40-Pin (Rear GPIO & Power)',
      },
    ],
  },
  {
    id: 'lidar',
    name: 'RPLIDAR A1 360° 2D Laser Range Scanner',
    nameVi: '5. Cụm Cảm Biến Khoảng Cách Laser RPLIDAR A1 360°',
    category: 'sensor',
    description:
      'Cảm biến laser đo khoảng cách quang học 2D xoay liên tục 360 độ đặt tại vị trí cao nhất của robot. Tháp quét quay ở tốc độ ~330 - 600 vòng/phút nhờ động cơ phụ không chổi than và dây đai truyền động timing belt. Phát ra hàng nghìn chùm xung laser hồng ngoại mỗi giây để đo khoảng cách theo nguyên lý tam giác đạc quang học (Triangulation).',
    functions: [
      'Quét toàn cảnh 360 độ xung quanh robot trong bán kính lên tới 12 mét với độ chính xác milimet.',
      'Phát hiện vật cản thời gian thực và kích hoạt dừng khẩn cấp (Emergency Stop) khi có vật cản đột ngột.',
      'Cung cấp đám mây điểm 2D LaserScan phục vụ thuật toán Gmapping / Cartographer SLAM xây dựng bản đồ số 2D phòng học CMU.',
      'Hỗ trợ thuật toán AMCL (Adaptive Monte Carlo Localization) định vị chính xác vị trí robot trên bản đồ đã có.',
    ],
    aiRole:
      'Cung cấp dữ liệu môi trường hình học 2D không bị ảnh hưởng bởi điều kiện ánh sáng (hoạt động tốt cả trong bóng tối hoàn toàn). Là cảm biến cốt lõi cho bản đồ chiếm chỗ (Costmap Layer) trong ROS2 Navigation2 Stack.',
    hardwareInterface: {
      protocol: 'UART Serial giao tiếp qua chip chuyển đổi CP2102 USB-to-UART (Baudrate: 115200 bps)',
      pinout: 'Cổng Micro-USB cắm trực tiếp vào cổng USB 3.0 của Jetson Nano (nhận cổng /dev/ttyUSB0)',
      voltage: '5V DC cấp qua cổng USB',
      powerConsumption: 'Điện áp 5V, dòng khởi động 600mA, dòng quay ổn định ~300mA (~1.5W)',
    },
    rosNode: {
      packageName: 'rplidar_ros',
      launchCommand: 'ros2 launch rplidar_ros rplidar_a1_launch.py serial_port:=/dev/ttyUSB0',
      topics: ['/scan (sensor_msgs/LaserScan)', '/scan/pointcloud'],
    },
    practicalNotes:
      'Khi vận hành, không dùng tay ghì chặt tháp quay của LiDAR để tránh trượt dây curoa truyền động. Cần thêm rule `99-rplidar.rules` trong udev của Ubuntu để cổng `/dev/rplidar` luôn cố định sau mỗi lần khởi động.',
    specs: {
      'Phạm vi đo': '0.15 m - 12.0 m',
      'Góc quét': '360° toàn cảnh không điểm mù',
      'Tần số quét vòng': '5.5 Hz - 10 Hz (330 - 600 RPM)',
      'Tốc độ lấy mẫu': '2000 - 4000 điểm đo mỗi giây (Sample Rate 8kHz)',
      'Độ phân giải góc': '≤ 1.0° tại tần số 5.5Hz',
      'Độ chính xác khoảng cách': '< 1% khoảng cách đo (khi khoảng cách < 3m)',
    },
    explodeOffset: { x: 0, y: 1.65, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/rada_36d71920.jpg',
        caption:
          'Ảnh thực tế mô-đun cảm biến RPLIDAR A1 tháo rời: tháp quay khắc chữ RPLIDAR, puli dây đai cao su (timing belt), động cơ DC kéo lệch tâm và tấm đế gá.',
        perspective: 'Mô-đun Radar RPLIDAR A1 thực tế (Detached Module)',
      },
      {
        url: '/assets/aistudio/anh2_4a33e607.jpg',
        caption:
          'Tháp quét laser hồng ngoại gắn hoàn chỉnh trên tầng đỉnh JetBot phục vụ tránh vật cản và lập bản đồ SLAM.',
        perspective: 'Góc gắn trên đỉnh xe (Mounted Top Turret)',
      },
    ],
  },
  {
    id: 'camera',
    name: 'Sony IMX219 8MP CSI Wide-Angle Camera & FFC Ribbon',
    nameVi: '6. Cụm Camera CSI Sony IMX219 8MP Góc Rộng 160° & Cáp Ribbon',
    category: 'sensor',
    description:
      'Mắt thần thị giác máy tính của JetBot. Trang bị cảm biến hình ảnh CMOS Sony IMX219 8 Megapixel cao cấp kết hợp ống kính góc siêu rộng 160° FoV (Fish-eye). Cụm camera được lắp trên giá đỡ nhôm CNC xanh lá phía trước xe có 2 núm vặn điều chỉnh góc ngẩng/nghiêng. Tín hiệu truyền trực tiếp vào bộ xử lý tín hiệu hình ảnh (ISP) của Jetson qua cáp dẹp mềm FFC 15 chân mà không qua bus USB.',
    functions: [
      'Thu nhận luồng video màu RGB độ nét cao 1080p@30fps hoặc 720p@60fps với độ trễ cực thấp (< 5ms).',
      'Cung cấp dữ liệu đầu vào cho mô hình mạng học sâu ResNet-18 phát hiện tâm vạch kẻ đường (Road Following).',
      'Phát hiện biển báo giao thông, người đi bộ và vật cản phía trước bằng mạng YOLOv8.',
      'Truyền luồng phát trực tiếp (Live RTSP Stream) về trình duyệt web phục vụ giám sát FPV từ xa.',
    ],
    aiRole:
      'Nguồn dữ liệu hình ảnh trực quan cho toàn bộ pipeline thị giác máy tính (Computer Vision Pipeline). Chạy qua bộ giải mã phần cứng NVMM của NVIDIA Jetson giúp giảm 0% tải CPU.',
    hardwareInterface: {
      protocol: 'MIPI CSI-2 băng thông cao 2-Lane (Băng thông lên đến 1.5 Gbps mỗi lane)',
      pinout: 'Cáp dẹp FFC 15 chân bước 1.0mm cắm vào cổng CAM0 trên bo mạch Jetson Nano',
      voltage: '3.3V cấp qua chân cáp FFC từ bo Jetson',
      powerConsumption: '~1.1W khi quay liên tục độ phân giải 1080p',
    },
    rosNode: {
      packageName: 'nvarguscamerasrc_ros',
      launchCommand: 'ros2 run v4l2_camera v4l2_camera_node --ros-args -p video_device:="/dev/video0"',
      topics: ['/camera/image_raw (sensor_msgs/Image)', '/camera/camera_info'],
    },
    practicalNotes:
      'Mặt tiếp xúc màu xanh của cáp FFC phải quay về phía tản nhiệt nhôm khi cắm vào khe CAM0 trên Jetson Nano. Cố định cáp nhẹ nhàng theo đường cong tự nhiên, không gấp nếp vuông góc 90° để tránh gãy các đường mạch đồng vi mô.',
    specs: {
      'Cảm biến ảnh': 'Sony IMX219 1/4" Color CMOS 8 Megapixels',
      'Góc quan sát (FoV)': '160° Diagonal Wide Angle (Mắt cá chống méo quang)',
      'Độ phân giải tối đa': '3280 × 2464 pixels',
      'Tốc độ khung hình': '1080p @ 30fps, 720p @ 60fps, 640x480 @ 90fps',
      'Độ dài tiêu cự': '2.0 mm có vòng chỉnh nét bằng tay',
      'Khớp gá camera': 'Khớp xoay nhôm xanh lá điều chỉnh góc ngẩng từ -20° đến +45°',
    },
    explodeOffset: { x: 0, y: 0.22, z: 0.38 },
    realPhotos: [
      {
        url: '/assets/aistudio/camera_2c331e75.jpg',
        caption:
          'Ảnh chụp cận cảnh trực diện camera Sony IMX219 ống kính góc siêu rộng 160°, giá đỡ nhôm CNC xanh lá với hai núm vặn chỉnh góc nghiêng và cáp FFC 15 chân chuẩn AWM 20706.',
        perspective: 'Trực diện Camera & Cáp FFC (Real Camera Close-up)',
      },
      {
        url: '/assets/aistudio/anh2_4a33e607.jpg',
        caption:
          'Tổng thể đầu xe với cụm camera Sony IMX219 hướng về phía trước phục vụ bám vạch và nhận diện vật cản.',
        perspective: 'Cụm quang học trên thân xe (Front Body View)',
      },
    ],
  },
  {
    id: 'antennas',
    name: 'Dual High-Gain Wi-Fi Antennas & Intel AC 8265 M.2',
    nameVi: '7. Cặp Anten Wi-Fi Kép Chuẩn SMA & Card M.2 Băng Tần Kép',
    category: 'electronic',
    description:
      'Cặp anten dạng gập (rubber ducky) gắn đối xứng ở đuôi robot thông qua đầu nối mạ vàng ren xoắn chuẩn SMA. Kết nối bằng cáp đồng trục siêu nhỏ IPEX/U.FL đến card Wi-Fi Intel Dual Band Wireless-AC 8265 cắm trong khe M.2 Key-E nằm phía dưới khối module Jetson Nano.',
    functions: [
      'Thiết lập đường truyền vô tuyến băng tần kép 2.4 GHz và 5 GHz với tốc độ lên đến 867 Mbps.',
      'Truyền telemetry thời gian thực (tốc độ motor, góc quay heading, điểm đo LiDAR, nhiệt độ CPU) với độ trễ < 15ms.',
      'Cung cấp kênh truyền điều khiển từ xa độ nhạy cao không bị nghẽn sóng trong môi trường phòng lab đông sinh viên.',
      'Hỗ trợ công nghệ 2x2 MU-MIMO tăng cường khả năng thu phát đa hướng ổn định khi robot di chuyển qua lại.',
    ],
    aiRole:
      'Hạ tầng truyền dẫn mạng cho các tác vụ tính toán phân tán (Edge-to-Cloud / Distributed ROS2 Nodes) và truyền stream video phục vụ huấn luyện mô hình học máy trên máy trạm GPU.',
    hardwareInterface: {
      protocol: 'Wi-Fi 802.11ac / a/b/g/n & Bluetooth 4.2 BLE qua bus PCIe M.2',
      pinout: 'Đầu nối chuẩn SMA Male mạ vàng gắn qua tấm đuôi xe; Cáp U.FL/IPEX nối card M.2',
      voltage: '3.3V cấp từ khe cắm M.2 của bo mạch chủ Jetson',
      powerConsumption: '~1.8W khi truyền phát dữ liệu cường độ cao',
    },
    rosNode: {
      packageName: 'telemetry_network_monitor',
      launchCommand: 'ros2 run jetbot_network wifi_diagnostics_node',
      topics: ['/network/wifi_status', '/network/ping_latency_ms'],
    },
    practicalNotes:
      'Nên đặt 2 anten nghiêng một góc 45° so với phương thẳng đứng theo hình chữ V để đạt góc phân cực sóng đa hướng tối ưu, đảm bảo bắt sóng ổn định nhất dù robot quay về bất kỳ góc nào.',
    specs: {
      'Băng tần hỗ trợ': '2.4 GHz (lên tới 300 Mbps) & 5 GHz (lên tới 867 Mbps)',
      'Độ lợi tín hiệu': '3 dBi - 5 dBi Omni-directional',
      'Chuẩn đầu cắm': 'SMA Knurled Connector mạ vàng chống nhiễu',
      'Card mạng': 'Intel Dual Band Wireless-AC 8265 M.2 2230',
      'Công nghệ truyền thông': '2x2 MU-MIMO, beamforming hỗ trợ kết nối xa tới 35 mét',
    },
    explodeOffset: { x: 0, y: 0.55, z: 0 },
    realPhotos: [
      {
        url: '/assets/aistudio/anten_b6257050.jpg',
        caption:
          'Ảnh thực tế cặp anten Wi-Fi kép băng tần 2.4/5GHz gắn đối xứng chữ V trên đuôi khung nhôm xanh qua đầu ren SMA mạ vàng.',
        perspective: 'Cặp Anten Đuôi Xe Thực Tế (Dual V-Antennas)',
      },
      {
        url: '/assets/aistudio/c_ng_k_t_n_i_6d2f76a5.jpg',
        caption:
          'Cận cảnh chân đế ren vặn SMA mạ vàng và dây cáp đồng trục U.FL luồn nối tới card mạng không dây bên trong Jetson Nano.',
        perspective: 'Đế ren SMA & dây Coax (SMA Mounts & Coax)',
      },
    ],
  },
];

export const JETBOT_VARIANT_COMPONENTS: Record<string, JetBotComponentInfo> = {
  stereoCamera: {
    id: 'stereoCamera',
    name: 'Dual-Camera Stereoscopic Depth Module',
    nameVi: 'Cụm Camera Kép Lập Thể Stereo Depth',
    category: 'sensor',
    description:
      'Hệ thống hai camera đặt song song trên thanh nhôm cố định khoảng cách cơ sở (baseline), cho phép tính toán bản đồ độ sâu (Disparity & Depth Map) 3D trực tiếp từ ảnh hai mắt.',
    functions: [
      'Ước lượng khoảng cách chính xác tới vật cản và biển báo dựa trên sai lệch thị sai giữa 2 ống kính.',
      'Hỗ trợ thuật toán Visual Odometry (VO) giúp định vị khi không dùng LiDAR.',
      'Cung cấp ảnh RGB đôi đồng bộ hóa khung hình cho mạng nơ-ron Stereo AI.',
    ],
    aiRole:
      'Cung cấp nhận thức chiều sâu 3D (3D Depth Perception) phục vụ né vật cản mật độ cao và tái dựng không gian 3D.',
    hardwareInterface: {
      protocol: 'Dual MIPI CSI-2 (CAM0 + CAM1)',
      pinout: 'Cáp FFC 15-pin kép cắm trên Jetson Nano B01 Dual CSI',
      voltage: '3.3V qua CSI Header',
      powerConsumption: '~2.2W tổng công suất hai cảm biến',
    },
    rosNode: {
      packageName: 'stereo_image_proc',
      launchCommand: 'ros2 launch jetbot_stereo stereo_depth.launch.py',
      topics: ['/stereo/left/image_raw', '/stereo/right/image_raw', '/stereo/points2'],
    },
    practicalNotes:
      'Cần hiệu chuẩn bàn cờ (Checkerboard Calibration) mỗi khi tháo lắp thanh gá nhôm để giữ thẳng hàng trục epipolar.',
    specs: {
      'Khoảng cách 2 mắt (Baseline)': '60 mm',
      'Cảm biến kép': '2 × Sony IMX219 8MP',
      'Tầm đo chiều sâu hiệu quả': '0.25 m – 4.5 m',
      'Khung gá': 'Nhôm CNC chống xoắn',
    },
    explodeOffset: { x: 0, y: 0.36, z: 0.62 },
    realPhotos: [
      {
        url: '/assets/aistudio/camera_2c331e75.jpg',
        caption: 'Cụm ống kính quang học Sony IMX219 góc rộng tương thích chuẩn CSI trên Jetson Nano.',
        perspective: 'Mô-đun quang học CSI (Optical CSI Reference)',
      },
    ],
  },
};

const PART_ID_ALIASES: Record<string, string> = {
  jetsonNano: 'jetson',
  board: 'motorBoard',
  stereo: 'stereoCamera',
};

/**
 * Resolves any 3D mesh userData.id or UI part id to its full hardware component metadata.
 */
export function resolveJetBotComponent(partId: string | null | undefined): JetBotComponentInfo | null {
  if (!partId) return null;
  const canonical = PART_ID_ALIASES[partId] ?? partId;
  const core = JETBOT_COMPONENTS.find((c) => c.id === canonical);
  if (core) return core;
  return JETBOT_VARIANT_COMPONENTS[canonical] ?? null;
}

/**
 * Maps a component id to the canonical studio visibility key (Model3DStudio partVisibilities).
 */
export function toStudioPartKey(partId: string): string {
  if (partId === 'jetson') return 'jetsonNano';
  if (partId === 'board') return 'motorBoard';
  if (partId === 'stereoCamera') return 'stereo';
  return partId;
}
