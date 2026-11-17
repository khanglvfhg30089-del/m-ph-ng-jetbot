/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, BookOpen, Cpu, SatelliteDish, CheckCircle2, Shield, Compass } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Tài Liệu Dự Án Mô Phỏng JetBot 3D - CMU Lớp 10A
              </h2>
              <p className="text-xs text-slate-400">
                Nghiên cứu nguyên lý, cấu tạo phần cứng và điều khiển Robot AI tự hành
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs leading-relaxed">
          {/* Section 1: Project Overview */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-5 rounded-2xl">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-900 text-emerald-300 border border-emerald-700">
              CMU Robotics Curriculum 10A
            </span>
            <h3 className="text-base font-extrabold text-white mt-2">
              Mục Tiêu & Tiêu Chuẩn Mô Phỏng Robot JetBot
            </h3>
            <p className="mt-1 text-slate-300">
              Mô phỏng 3D này được phát triển dựa trên chính xác mẫu robot JetBot thực tế của lớp (sử dụng khung nhôm sơn xanh lá cây ánh kim, mâm bánh xe xanh dương metallic, cụm cảm biến laser RPLIDAR trên tầng thượng và bo mạch xử lý trí tuệ nhân tạo NVIDIA Jetson Nano).
            </p>
          </div>

          {/* Section 2: 3 Core Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold">
                1
              </div>
              <h4 className="font-bold text-slate-200">Hệ Dẫn Động Vi Sai</h4>
              <p className="text-slate-400 text-[11px]">
                JetBot chuyển hướng bằng cách điều chỉnh chênh lệch tốc độ giữa 2 bánh xe chủ động trái và phải (Differential Drive). Bánh tự do caster phía trước đóng vai trò điểm tựa cân bằng 3 điểm.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
                2
              </div>
              <h4 className="font-bold text-slate-200">Cảm Biến RPLIDAR 360°</h4>
              <p className="text-slate-400 text-[11px]">
                Cụm cảm biến laser quay liên tục 360 độ bằng động cơ và dây đai riêng, đo khoảng cách đến vật cản theo phương pháp ToF (Time of Flight) để xây dựng bản đồ radar 2D không điểm mù.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center font-bold">
                3
              </div>
              <h4 className="font-bold text-slate-200">Thị Giác AI Máy Tính</h4>
              <p className="text-slate-400 text-[11px]">
                Camera CSI Sony IMX219 8MP góc rộng 160° truyền tín hiệu trực tiếp vào GPU NVIDIA Jetson Nano, xử lý mô hình Deep Learning (YOLOv8) để phân loại vật thể và tự dò đường đi.
              </p>
            </div>
          </div>

          {/* Section 3: Hardware Specifications */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-emerald-400 text-sm flex items-center">
              <Cpu className="w-4 h-4 mr-2" /> Bảng Phân Tầng Cấu Trúc Phần Cứng Thực Tế
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Tầng 0 (Đế & Truyền động):</strong> Tấm hợp kim nhôm sơn tĩnh điện xanh lá ánh kim (Green Anodized), 2 động cơ TT Motor 1:48, 2 bánh xe mâm xanh dương metallic (Blue Rims) lốp gai, 1 bánh xe cầu xoay tự do kim loại (Ball Caster).
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Tầng 1 (Điều khiển & Nguồn):</strong> Bo mạch mở rộng Waveshare tích hợp IC điều khiển động cơ I2C TB6612FNG, khay 3 cell pin 18650 Li-ion 12.6V, công tắc gạt nguồn On/Off, giắc sạc DC barrel.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Tầng 2 (Xử lý trung tâm AI):</strong> Bo mạch NVIDIA Jetson Nano với 128 nhân CUDA Maxwell, khối tản nhiệt nhôm đen có quạt tản nhiệt, 4 cổng USB 3.0, cổng mạng Gigabit RJ45, 40 chân GPIO.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Tầng 3 (Cảm biến Laser & Camera):</strong> Tấm mặt trên đỡ cảm biến RPLIDAR A1/A2 kết nối motor kéo dây đai; phía trước là cụm camera CSI Sony 8MP cáp dẹp trắng; phía sau là cặp anten Wi-Fi kép SMA gập góc.
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Control Guide */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-cyan-400 text-sm flex items-center">
              <Compass className="w-4 h-4 mr-2" /> Hướng Dẫn Điều Khiển & Phím Tắt
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-1">Di Chuyển Robot:</span>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">W</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↑</kbd>: Tiến tới</p>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">S</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↓</kbd>: Lùi lại</p>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">A</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">←</kbd>: Rẽ trái</p>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">D</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">→</kbd>: Rẽ phải</p>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Space</kbd>: Dừng khẩn cấp</p>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold block mb-1">Góc Nhìn & Bóc Tách:</span>
                <p className="text-slate-300">Phím <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">H</kbd>: Ẩn/Hiện thanh điều khiển</p>
                <p className="text-slate-300">Chuột trái + Kéo: Xoay tự do 360°</p>
                <p className="text-slate-300">Cuộn chuột: Thu phóng camera</p>
                <p className="text-slate-300">Nhấp vào linh kiện 3D: Xem thông số</p>
                <p className="text-slate-300">Thanh trượt Bóc Tách: Tách rời các tầng</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
          >
            Đã Hiểu & Quay Lại Mô Phỏng
          </button>
        </div>
      </div>
    </div>
  );
};
