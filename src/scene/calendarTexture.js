// =============================================================
// scene/calendarTexture.js
// 벽 달력 그림 (1998년 11월). 3D 벽 달력과, 달력을 클릭했을 때 뜨는 크게 보기 화면이
// 같은 그림을 쓰도록 여기 한 곳에서 그린다.
// 3일: 빨간 동그라미 + '하은 생일♥' / 17일: 덧칠한 'J'
// =============================================================

/** @param {HTMLCanvasElement} c  가로:세로 = 3:4 권장 */
export function drawCalendar(c) {
  const W = c.width;
  const H = c.height;
  const s = W / 384; // 384×512 기준으로 그린 뒤 크기만 맞춤
  const g = c.getContext('2d');
  g.save();
  g.scale(s, H / 512);
  // 종이 + 누렇게 바랜 얼룩
  g.fillStyle = '#efe6d0';
  g.fillRect(0, 0, 384, 512);
  const stain = g.createRadialGradient(300, 430, 10, 300, 430, 140);
  stain.addColorStop(0, 'rgba(150,110,60,.25)');
  stain.addColorStop(1, 'rgba(150,110,60,0)');
  g.fillStyle = stain;
  g.fillRect(0, 0, 384, 512);
  // 머리 (월)
  g.fillStyle = '#7a1a12';
  g.fillRect(0, 0, 384, 120);
  g.fillStyle = '#f6e8d0';
  g.font = 'bold 64px serif';
  g.textAlign = 'center';
  g.fillText('11월', 192, 78);
  g.font = '24px serif';
  g.fillText('1998', 192, 108);
  // 요일
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  g.font = 'bold 20px sans-serif';
  days.forEach((d, i) => {
    g.fillStyle = i === 0 ? '#b0201a' : '#3a2a20';
    g.fillText(d, 30 + i * 54, 150);
  });
  g.strokeStyle = 'rgba(60,40,30,.25)';
  g.lineWidth = 1;
  for (let r = 0; r <= 5; r++) {
    g.beginPath();
    g.moveTo(4, 162 + r * 62);
    g.lineTo(380, 162 + r * 62);
    g.stroke();
  }
  // 날짜 (1998년 11월 1일 = 일요일)
  for (let d = 1; d <= 30; d++) {
    const col = (d - 1) % 7;
    const row = Math.floor((d - 1) / 7);
    const x = 30 + col * 54;
    const y = 196 + row * 62;
    g.font = 'bold 26px sans-serif';
    g.fillStyle = col === 0 ? '#b0201a' : '#2a2018';
    g.fillText(String(d), x, y);
    if (d === 3) {
      g.strokeStyle = '#d0201a';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(x, y - 9, 24, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#d0201a';
      g.font = 'bold 15px sans-serif';
      g.fillText('하은 생일♥', x + 6, y + 30);
    }
    if (d === 17) {
      g.fillStyle = 'rgba(20,10,10,.85)';
      g.font = 'bold 34px serif';
      g.fillText('J', x + 14, y + 16);
      g.fillText('J', x - 12, y + 20);
    }
  }
  g.restore();
}
